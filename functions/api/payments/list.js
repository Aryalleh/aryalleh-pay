// GET /api/payments/list — Authorization: Bearer <service_token>
import { authService, unauthorized } from "../../../lib/auth.js";
import { getPendingPayments } from "../../../lib/db.js";
import { jsonResponse } from "../../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const svc = await authService(request, env);
    if (!svc) return unauthorized();

    const payments = await getPendingPayments(env, svc.id);
    return jsonResponse({ ok: true, payments });
}
