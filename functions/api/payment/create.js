// POST /api/payment/create — Authorization: Bearer <service_token>
import { authService, unauthorized } from "../../../lib/auth.js";
import { findUniqueAmount, isAmountPending, createPendingPayment } from "../../../lib/db.js";
import { jsonResponse } from "../../../lib/render.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const svc = await authService(request, env);
    if (!svc) return unauthorized();

    const data = await request.json().catch(() => ({}));
    const orderId = data.order_id;
    let amountRials = data.amount_rials;
    const description = data.description || "";
    // The service's configured expiry (panel → services → "مبلغ / انقضا")
    // always wins — expires_minutes from the request body is ignored,
    // since sellers' integrations often hardcode their own value, which
    // would otherwise silently override whatever the admin sets in the panel.
    const expiresMinutes = (svc.default_expire_hours || 1) * 60;

    if (!orderId || !amountRials) {
        return jsonResponse({ ok: false, error: "order_id and amount_rials are required" }, 400);
    }

    try {
        amountRials = parseInt(amountRials, 10);
        const redirectUrl = data.redirect_url || "";

        // Matching happens purely off the deposited amount, so it must be
        // unique among currently-pending payments. Whether the gateway
        // auto-bumps a conflicting amount or leaves uniqueness up to the
        // seller (returning 409 amount_conflict instead) is a per-service
        // setting — some sellers already generate unique amounts themselves.
        let finalAmount = amountRials;
        if (svc.auto_adjust_amount) {
            finalAmount = await findUniqueAmount(env, amountRials);
        } else if (await isAmountPending(env, amountRials)) {
            return jsonResponse({
                ok: false,
                error: "amount_conflict",
                message: `مبلغ ${amountRials.toLocaleString("en-US")} ریال در حال حاضر روی یه سفارش دیگه pending است. چند ریال تفاوت بده تا یکتا بشه.`,
            }, 409);
        }

        const result = await createPendingPayment(env, svc.id, orderId, finalAmount, description, expiresMinutes, redirectUrl);
        const payUrl = `/pay/${result.pay_token}`;
        return jsonResponse({
            ok: true,
            ...result,
            pay_url: payUrl,
            requested_amount_rials: amountRials,
            amount_adjusted: finalAmount !== amountRials,
        });
    } catch (e) {
        return jsonResponse({ ok: false, error: String(e.message || e) }, 409);
    }
}

export async function onRequestOptions() {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}
