// POST /api/sms/receive — from the Telegram forwarder bot or any SMS source.
// Whether the Bearer secret key is required is admin-configurable (panel → settings).
import { getSmsToken, isSmsTokenRequired, isNotifyAllSmsEnabled, getBotSettings } from "../../../lib/db.js";
import { processSmsMessage } from "../../../lib/sms_processor.js";
import { sendMessage } from "../../../lib/telegram.js";
import { jsonResponse } from "../../../lib/render.js";
import { unauthorized } from "../../../lib/auth.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    if (await isSmsTokenRequired(env)) {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        const expected = await getSmsToken(env);
        if (!token || token !== expected) return unauthorized();
    }

    const data = await request.json().catch(() => ({}));
    const message = (data.message || "").trim();
    if (!message) return jsonResponse({ ok: false, error: "message is required" }, 400);

    const result = await processSmsMessage(env, message);

    if (await isNotifyAllSmsEnabled(env)) {
        await notifyAdminOfIncomingSms(env, message, result);
    }

    return jsonResponse({
        ok: true,
        parsed: result.parsed,
        matched: result.matched,
        amount_rials: result.amount,
        sms_id: result.sms_id,
        order_id: result.order_id,
        service: result.service,
        tx_id: result.tx_id,
    });
}

// "Listen to all": forwards the raw SMS text to the admin regardless of
// whether it ended up confirming a payment — sent as plain text (no
// Markdown parsing) since raw bank SMS content can contain characters that
// break Telegram's Markdown parser.
async function notifyAdminOfIncomingSms(env, message, result) {
    const cfg = await getBotSettings(env);
    if (!cfg.bot_token || !cfg.admin_chat_id) return;

    let statusLine;
    if (!result.parsed) {
        statusLine = "⚠️ قابل تجزیه نبود";
    } else if (!result.matched) {
        statusLine = `❌ مطابقتی یافت نشد — مبلغ: ${Number(result.amount).toLocaleString("en-US")} ریال`;
    } else {
        statusLine = `✅ پرداخت تأیید شد — سرویس: ${result.service} — سفارش: ${result.order_id} — مبلغ: ${Number(result.amount).toLocaleString("en-US")} ریال`;
    }

    const text = `📨 پیامک از API دریافت شد:\n\n${message}\n\n${statusLine}`;
    await sendMessage(cfg.bot_token, cfg.admin_chat_id, text, null, null);
}
