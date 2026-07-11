// POST /api/payment/create — Authorization: Bearer <service_token>
import { authService, unauthorized } from "../../../lib/auth.js";
import { isAmountPending, createPendingPayment } from "../../../lib/db.js";
import { jsonResponse } from "../../../lib/render.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const svc = await authService(request, env);
    if (!svc) return unauthorized();

    const data = await request.json().catch(() => ({}));
    const orderId = data.order_id;
    let amountRials = data.amount_rials;
    const description = data.description || "";
    const expiresMinutes = parseInt(data.expires_minutes ?? 60, 10);

    if (!orderId || !amountRials) {
        return jsonResponse({ ok: false, error: "order_id and amount_rials are required" }, 400);
    }

    try {
        amountRials = parseInt(amountRials, 10);
        const redirectUrl = data.redirect_url || "";

        if (await isAmountPending(env, amountRials)) {
            return jsonResponse({
                ok: false,
                error: "amount_conflict",
                message: `مبلغ ${amountRials.toLocaleString("en-US")} ریال در حال حاضر روی یه سفارش دیگه pending است. چند ریال تفاوت بده تا یکتا بشه.`,
            }, 409);
        }

        const result = await createPendingPayment(env, svc.id, orderId, amountRials, description, expiresMinutes, redirectUrl);
        const payUrl = `/pay/${result.pay_token}`;
        return jsonResponse({ ok: true, ...result, pay_url: payUrl });
    } catch (e) {
        return jsonResponse({ ok: false, error: String(e.message || e) }, 409);
    }
}

export async function onRequestOptions() {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}
