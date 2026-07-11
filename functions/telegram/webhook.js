// POST /telegram/webhook — replaces the old long-polling bot_runner.py thread,
// which can't run on Cloudflare Pages (no persistent background processes).
// Telegram calls this URL directly for every update once setWebhook is registered
// (see functions/panel/settings/save-bot.js). Verified via the per-deployment
// secret_token header Telegram echoes back on each call.
import { getBotSettings, getPendingPayments, manualConfirmPayment } from "../../lib/db.js";
import { processSmsMessage, fireCallback } from "../../lib/sms_processor.js";
import { sendMessage, editMessageText, answerCallbackQuery, confirmKeyboard } from "../../lib/telegram.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const cfg = await getBotSettings(env);
    if (!cfg.bot_token || !cfg.admin_chat_id) {
        return new Response("bot not configured", { status: 200 });
    }

    const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!cfg.telegram_webhook_secret || secretHeader !== cfg.telegram_webhook_secret) {
        return new Response("forbidden", { status: 403 });
    }

    const update = await request.json().catch(() => null);
    if (!update) return new Response("ok", { status: 200 });

    const botToken = cfg.bot_token;
    const adminChatId = String(cfg.admin_chat_id);

    if (update.callback_query) {
        await handleCallbackQuery(env, botToken, adminChatId, update.callback_query);
        return new Response("ok", { status: 200 });
    }

    const msg = update.message;
    if (msg && (msg.text || msg.caption)) {
        await handleMessage(env, botToken, adminChatId, msg);
    }

    return new Response("ok", { status: 200 });
}

async function handleMessage(env, botToken, adminChatId, msg) {
    const text = (msg.text || msg.caption || "").trim();
    const chatId = String(msg.chat.id);

    if (text === "/start") {
        await sendMessage(botToken, chatId,
            "💳 *AryallehPay Bot*\n\nپیامک بانکی بفرست تا پردازش بشه.\n/pending — سفارش‌های در انتظار");
        return;
    }

    if (text === "/pending") {
        if (chatId !== adminChatId) return;
        const payments = (await getPendingPayments(env)).filter((p) => p.status === "pending");
        if (payments.length === 0) {
            await sendMessage(botToken, chatId, "✅ پرداخت در انتظاری وجود ندارد");
            return;
        }
        for (const p of payments.slice(0, 10)) {
            await sendMessage(
                botToken, chatId,
                `⏳ *${p.service_name}*\nسفارش: \`${p.order_id}\`\nمبلغ: \`${Number(p.amount_rials).toLocaleString("en-US")}\` ریال\nانقضا: ${p.expires_at || "—"}`,
                confirmKeyboard(p.id, p.order_id)
            );
        }
        return;
    }

    // Any other text is treated as a forwarded bank SMS.
    const result = await processSmsMessage(env, text);
    if (!result.parsed) return;

    if (!result.matched) {
        await sendMessage(botToken, adminChatId,
            `📥 *پیامک دریافت شد — تطبیق نیافت*\n\nمبلغ: \`${Number(result.amount).toLocaleString("en-US")}\` ریال\nهیچ سفارشی با این مبلغ وجود ندارد`);
        return;
    }

    await sendMessage(botToken, adminChatId,
        `✅ *پرداخت تأیید شد!*\n\nسرویس: ${result.service}\nسفارش: \`${result.order_id}\`\nمبلغ: \`${Number(result.amount).toLocaleString("en-US")}\` ریال\nتراکنش: #${result.tx_id}`);
}

async function handleCallbackQuery(env, botToken, adminChatId, callbackQuery) {
    await answerCallbackQuery(botToken, callbackQuery.id);

    const chatId = String(callbackQuery.message?.chat?.id || "");
    if (chatId !== adminChatId) return;
    if (!callbackQuery.data || !callbackQuery.data.startsWith("confirm:")) return;

    const parts = callbackQuery.data.split(":");
    const pid = parseInt(parts[1], 10);
    const orderId = parts[2] || "?";

    try {
        const result = await manualConfirmPayment(env, pid, "تأیید دستی از بات تلگرام");
        const { payment, tx_id: txId, paid_at: paidAt } = result;
        if (payment.callback_url) await fireCallback(env, txId, payment, paidAt);
        await editMessageText(botToken, chatId, callbackQuery.message.message_id,
            `✅ *تأیید شد*\n\nسفارش: \`${orderId}\`\nتراکنش: #${txId}`);
    } catch (e) {
        await editMessageText(botToken, chatId, callbackQuery.message.message_id,
            `❌ ${e.message || "خطای نامشخص"}`);
    }
}
