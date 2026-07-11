// GET /api/pay/poll/:pay_token — unauthenticated, polled every few seconds by the checkout page
import { getPaymentByToken } from "../../../../lib/db.js";
import { jsonResponse } from "../../../../lib/render.js";

export async function onRequestGet(context) {
    const { env, params } = context;
    const payment = await getPaymentByToken(env, params.pay_token);
    if (!payment) return jsonResponse({ ok: false, error: "not found" }, 404);
    return jsonResponse({
        ok: true,
        status: payment.status,
        redirect_url: payment.redirect_url || "",
    });
}
