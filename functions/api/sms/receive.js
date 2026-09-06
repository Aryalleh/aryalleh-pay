// POST /api/sms/receive — from the Telegram forwarder bot or any SMS source.
// Whether the Bearer secret key is required is admin-configurable (panel → settings).
// The Bearer token may instead be a specific device's token (panel → دستگاه‌ها);
// when it is, matching/uniqueness is scoped to that device's services and its
// last_seen_at is updated for the online/offline indicator.
import { getSmsToken, isSmsTokenRequired, isNotifyAllSmsEnabled, getBotSettings, getDeviceByToken, touchDeviceLastSeen } from "../../../lib/db.js";
import { processSmsMessage } from "../../../lib/sms_processor.js";
import { sendMessage } from "../../../lib/telegram.js";
import { jsonResponse } from "../../../lib/render.js";
import { unauthorized } from "../../../lib/auth.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    let device = token ? await getDeviceByToken(env, token) : null;
    if (device) {
        await touchDeviceLastSeen(env, device.id);
    } else if (await isSmsTokenRequired(env)) {
        const expected = await getSmsToken(env);
        if (!token || token !== expected) return unauthorized();
    }

    const data = await request.json().catch(() => ({}));
    const message = (data.message || "").trim();
    if (!message) return jsonResponse({ ok: false, error: "message is required" }, 400);

    const result = await processSmsMessage(env, message, device ? device.id : null);

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
