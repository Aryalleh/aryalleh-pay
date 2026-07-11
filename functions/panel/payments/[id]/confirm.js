import { manualConfirmPayment } from "../../../../lib/db.js";
import { fireCallback } from "../../../../lib/sms_processor.js";
import { redirectWithFlash } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const pid = parseInt(params.id, 10);
    const form = await request.formData();
    const note = (form.get("note") || "").trim();

    try {
        const result = await manualConfirmPayment(env, pid, note);
        const { payment, tx_id: txId, paid_at: paidAt } = result;
        if (payment.callback_url) {
            await fireCallback(env, txId, payment, paidAt);
        }
        return redirectWithFlash(
            "/panel/payments",
            `✅ پرداخت #${pid} (سفارش ${payment.order_id}) تأیید شد | تراکنش #${txId}`,
            "info"
        );
    } catch (e) {
        return redirectWithFlash("/panel/payments", `خطا: ${e.message || e}`, "error");
    }
}
