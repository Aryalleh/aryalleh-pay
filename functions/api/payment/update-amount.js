// POST /api/payment/update-amount — Authorization: Bearer <service_token>
// Lets a seller correct an invoice's amount, but only while it's still
// pending — once a payment is matched (paid), its recorded amount is
// financial history and must not be silently rewritten.
import { authService, unauthorized } from "../../../lib/auth.js";
import {
    getPendingPayments, isAmountPendingExcluding, findUniqueAmountExcluding, updatePaymentAmount,
} from "../../../lib/db.js";
import { jsonResponse } from "../../../lib/render.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const svc = await authService(request, env);
    if (!svc) return unauthorized();

    const data = await request.json().catch(() => ({}));
    const orderId = data.order_id;
    let newAmount = data.amount_rials;

    if (!orderId || newAmount == null) {
        return jsonResponse({ ok: false, error: "order_id and amount_rials are required" }, 400);
    }
    newAmount = parseInt(newAmount, 10);
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
        return jsonResponse({ ok: false, error: "amount_rials must be a positive integer" }, 400);
    }

    const payments = await getPendingPayments(env, svc.id);
    const payment = payments.find((p) => p.order_id === orderId);
    if (!payment) return jsonResponse({ ok: false, error: "Not found" }, 404);

    if (payment.status !== "pending") {
        return jsonResponse({
            ok: false,
            error: "already_paid",
            message: "این پرداخت قبلاً تأیید شده و مبلغ آن دیگر قابل تغییر نیست",
        }, 409);
    }

    try {
        // Same per-service policy as payment/create: auto-adjust a
        // conflicting amount, or reject with 409 if that's turned off.
        let finalAmount = newAmount;
        if (svc.auto_adjust_amount) {
            finalAmount = await findUniqueAmountExcluding(env, newAmount, payment.id);
        } else if (await isAmountPendingExcluding(env, newAmount, payment.id)) {
            return jsonResponse({
                ok: false,
                error: "amount_conflict",
                message: `مبلغ ${newAmount.toLocaleString("en-US")} ریال در حال حاضر روی یه سفارش دیگه pending است.`,
            }, 409);
        }

        const updated = await updatePaymentAmount(env, payment.id, finalAmount);
        if (!updated || updated.status !== "pending" || updated.amount_rials !== finalAmount) {
            // Payment got matched in the moment between our checks above and
            // the update itself — the guard in updatePaymentAmount() refused
            // to touch it.
            return jsonResponse({
                ok: false,
                error: "already_paid",
                message: "این پرداخت هم‌زمان تأیید شد؛ مبلغ تغییر نکرد",
            }, 409);
        }

        return jsonResponse({
            ok: true,
            order_id: orderId,
            amount_rials: updated.amount_rials,
            requested_amount_rials: newAmount,
            amount_adjusted: finalAmount !== newAmount,
        });
    } catch (e) {
        return jsonResponse({ ok: false, error: String(e.message || e) }, 409);
    }
}

export async function onRequestOptions() {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}
