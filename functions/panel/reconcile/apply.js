// POST /panel/reconcile/apply — session-authenticated (via
// functions/panel/_middleware.js), called by the client-side script in
// functions/panel/reconcile.js after it extracts deposit amounts from an
// uploaded bank statement PDF in the browser. Auto-confirms any pending
// payment whose amount matches one of the submitted deposits.
import { getPendingPayments, manualConfirmPayment } from "../../../lib/db.js";
import { fireCallback } from "../../../lib/sms_processor.js";
import { jsonResponse } from "../../../lib/render.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const data = await request.json().catch(() => ({}));
    const deposits = Array.isArray(data.deposits) ? data.deposits : [];

    const depositAmounts = new Set();
    for (const d of deposits) {
        const amt = parseInt(d && d.amount, 10);
        if (Number.isFinite(amt) && amt > 0) depositAmounts.add(amt);
    }

    const allPayments = await getPendingPayments(env);
    const pending = allPayments.filter((p) => p.status === "pending");

    const matched = [];
    const stillPending = [];

    for (const payment of pending) {
        if (!depositAmounts.has(payment.amount_rials)) {
            stillPending.push({
                order_id: payment.order_id,
                service_name: payment.service_name,
                amount_rials: payment.amount_rials,
            });
            continue;
        }
        try {
            const result = await manualConfirmPayment(env, payment.id, "تأیید خودکار از صورتحساب بانکی (PDF)");
            const { payment: p, tx_id: txId, paid_at: paidAt } = result;
            if (p.callback_url) await fireCallback(env, txId, p, paidAt);
            matched.push({
                order_id: payment.order_id,
                service_name: payment.service_name,
                amount_rials: payment.amount_rials,
                tx_id: txId,
            });
        } catch (e) {
            // Matched by something else (e.g. a real-time SMS) between our
            // read and this write — not an error, just leave it as-is.
            stillPending.push({
                order_id: payment.order_id,
                service_name: payment.service_name,
                amount_rials: payment.amount_rials,
            });
        }
    }

    return jsonResponse({ ok: true, matched, still_pending: stillPending });
}
