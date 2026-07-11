"""bot_runner.py — بات تلگرام رو توی یه thread جداگانه مدیریت می‌کنه"""
import logging
import threading
import asyncio
import httpx
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Bot
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler,
    CallbackQueryHandler, ContextTypes, filters
)
from models import get_bot_settings, get_pending_payments, manual_confirm_payment

logger = logging.getLogger(__name__)

_thread: threading.Thread | None = None
_stop_event = threading.Event()


# ── handlers ───────────────────────────────────────────────────────────────────

def _make_handlers(cfg: dict):
    API_BASE      = "http://localhost:5050"
    ADMIN_CHAT_ID = int(cfg["admin_chat_id"])
    SVC_HEADERS   = {"Authorization": f"Bearer {cfg['bot_service_token']}"}

    async def notify(bot: Bot, text: str, keyboard=None):
        await bot.send_message(ADMIN_CHAT_ID, text, parse_mode="Markdown", reply_markup=keyboard)

    async def cmd_start(update, ctx):
        await update.message.reply_text(
            "💳 *AryallehPay Bot*\n\nپیامک بانکی بفرست تا پردازش بشه.\n/pending — سفارش‌های در انتظار",
            parse_mode="Markdown"
        )

    async def cmd_pending(update, ctx):
        if update.effective_chat.id != ADMIN_CHAT_ID:
            return
        try:
            resp = httpx.get(f"{API_BASE}/api/payments/list", headers=SVC_HEADERS, timeout=8)
            payments = [p for p in resp.json().get("payments", []) if p["status"] == "pending"]
        except Exception as e:
            await update.message.reply_text(f"❌ خطا: {e}")
            return
        if not payments:
            await update.message.reply_text("✅ پرداخت در انتظاری وجود ندارد")
            return
        for p in payments[:10]:
            kb = InlineKeyboardMarkup([[
                InlineKeyboardButton("✅ تأیید دستی", callback_data=f"confirm:{p['id']}:{p['order_id']}")
            ]])
            await update.message.reply_text(
                f"⏳ *{p['service_name']}*\nسفارش: `{p['order_id']}`\nمبلغ: `{p['amount_rials']:,}` ریال\nانقضا: {p['expires_at'] or '—'}",
                parse_mode="Markdown", reply_markup=kb
            )

    async def handle_message(update, ctx):
        text = (update.message.text or update.message.caption or "").strip()
        if not text:
            return
        try:
            resp = httpx.post(f"{API_BASE}/api/sms/receive", json={"message": text}, timeout=10)
            data = resp.json()
        except Exception as e:
            await notify(ctx.bot, f"❌ خطا در اتصال: {e}")
            return
        if not data.get("parsed"):
            return
        if not data.get("matched"):
            await notify(ctx.bot,
                f"📥 *پیامک دریافت شد — تطبیق نیافت*\n\nمبلغ: `{data['amount_rials']:,}` ریال\nهیچ سفارشی با این مبلغ وجود ندارد"
            )
            return
        await notify(ctx.bot,
            f"✅ *پرداخت تأیید شد!*\n\nسرویس: {data['service']}\nسفارش: `{data['order_id']}`\nمبلغ: `{data['amount_rials']:,}` ریال\nتراکنش: #{data['tx_id']}"
        )

    async def handle_callback(update, ctx):
        query = update.callback_query
        await query.answer()
        if update.effective_chat.id != ADMIN_CHAT_ID:
            return
        if not query.data.startswith("confirm:"):
            return
        parts    = query.data.split(":", 2)
        pid      = int(parts[1])
        order_id = parts[2] if len(parts) > 2 else "?"
        try:
            resp = httpx.post(
                f"{API_BASE}/api/payment/manual-confirm",
                json={"payment_id": pid, "note": "تأیید دستی از بات تلگرام"},
                headers=SVC_HEADERS, timeout=10
            )
            result = resp.json()
        except Exception as e:
            await query.edit_message_text(f"❌ خطا: {e}")
            return
        if result.get("ok"):
            await query.edit_message_text(
                f"✅ *تأیید شد*\n\nسفارش: `{order_id}`\nتراکنش: #{result.get('tx_id')}",
                parse_mode="Markdown"
            )
        else:
            await query.edit_message_text(f"❌ {result.get('error', 'خطای نامشخص')}")

    return cmd_start, cmd_pending, handle_message, handle_callback


# ── thread runner ──────────────────────────────────────────────────────────────

def _run_bot(cfg: dict, stop_event: threading.Event):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    cmd_start, cmd_pending, handle_message, handle_callback = _make_handlers(cfg)

    app = ApplicationBuilder().token(cfg["bot_token"]).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("pending", cmd_pending))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    async def _run():
        async with app:
            await app.start()
            await app.updater.start_polling()
            logger.info("Telegram bot started")
            while not stop_event.is_set():
                await asyncio.sleep(1)
            await app.updater.stop()
            await app.stop()
            logger.info("Telegram bot stopped")

    try:
        loop.run_until_complete(_run())
    finally:
        loop.close()


def start_bot():
    global _thread, _stop_event
    cfg = get_bot_settings()
    if not cfg.get("bot_token") or not cfg.get("admin_chat_id") or not cfg.get("bot_service_token"):
        logger.warning("Bot settings incomplete — bot not started. Configure in panel /settings")
        return
    _stop_event = threading.Event()
    _thread = threading.Thread(target=_run_bot, args=(cfg, _stop_event), daemon=True)
    _thread.start()
    logger.info("Bot thread started")


def stop_bot():
    global _thread, _stop_event
    if _thread and _thread.is_alive():
        _stop_event.set()
        _thread.join(timeout=5)
        logger.info("Bot thread stopped")


def restart_bot():
    stop_bot()
    start_bot()
