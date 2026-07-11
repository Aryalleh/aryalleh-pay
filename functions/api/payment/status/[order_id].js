// GET /api/payment/status/:order_id — Authorization: Bearer <service_token>
import { authService, unauthorized } from "../../../../lib/auth.js";
import { getPendingPayments } from "../../../../lib/db.js";
import { jsonResponse } from "../../../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const svc = await authService(request, env);
    if (!svc) return unauthorized();

    const payments = await getPendingPayments(env, svc.id);
    const payment = payments.find((p) => p.order_id === params.order_id);
    if (!payment) return jsonResponse({ ok: false, error: "Not found" }, 404);

    return jsonResponse({
        ok: true, status: payment.status,
        amount_rials: payment.amount_rials,
        created_at: payment.created_at,
        expires_at: payment.expires_at,
    });
}
