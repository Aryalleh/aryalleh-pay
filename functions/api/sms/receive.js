// POST /api/sms/receive — from the Telegram forwarder bot or any SMS source.
// Whether the Bearer secret key is required is admin-configurable (panel → settings).
import { getSmsToken, isSmsTokenRequired } from "../../../lib/db.js";
import { processSmsMessage } from "../../../lib/sms_processor.js";
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
