// POST /api/payment/manual-confirm — Authorization: Bearer <service_token>
import { authService, unauthorized } from "../../../lib/auth.js";
import { manualConfirmPayment } from "../../../lib/db.js";
import { fireCallback } from "../../../lib/sms_processor.js";
import { jsonResponse } from "../../../lib/render.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const svc = await authService(request, env);
    if (!svc) return unauthorized();

    const data = await request.json().catch(() => ({}));
    const paymentId = data.payment_id;
    const note = data.note || "";
    if (!paymentId) return jsonResponse({ ok: false, error: "payment_id required" }, 400);

    try {
        const result = await manualConfirmPayment(env, parseInt(paymentId, 10), note);
        const { payment, tx_id: txId, paid_at: paidAt } = result;
        if (payment.callback_url) await fireCallback(env, txId, payment, paidAt);
        return jsonResponse({ ok: true, tx_id: txId, order_id: payment.order_id, paid_at: paidAt });
    } catch (e) {
        return jsonResponse({ ok: false, error: String(e.message || e) }, 409);
    }
}
