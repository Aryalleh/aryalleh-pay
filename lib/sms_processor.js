// lib/sms_processor.js — shared "incoming SMS text" pipeline used by both the
// public /api/sms/receive endpoint and the Telegram webhook handler.
import { parseSms } from "./sms_parser.js";
import {
    logSms, findMatchingPayment, markPaymentMatched,
    createTransaction, updateCallbackStatus,
} from "./db.js";

export async function fireCallback(env, txId, payment, paidAt) {
    const payload = {
        event: "payment.confirmed",
        order_id: payment.order_id,
        amount_rials: payment.amount_rials,
        paid_at: paidAt,
        tx_id: txId,
    };
    try {
        const resp = await fetch(payment.callback_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const text = await resp.text();
        await updateCallbackStatus(env, txId, "success", text.slice(0, 500));
    } catch (e) {
        await updateCallbackStatus(env, txId, "failed", String(e.message || e).slice(0, 500));
    }
}

/**
 * @returns {{parsed: boolean, matched: boolean, amount?: number, sms_id?: number,
 *            order_id?: string, service?: string, tx_id?: number}}
 */
export async function processSmsMessage(env, message) {
    const { amount, paidAt } = parseSms(message);
    if (amount === null) {
        const smsId = await logSms(env, message, null, null, "failed", null);
        return { parsed: false, sms_id: smsId };
    }

    const payment = await findMatchingPayment(env, amount);
    if (!payment) {
        const smsId = await logSms(env, message, amount, paidAt, "ok", null);
        return { parsed: true, matched: false, amount, sms_id: smsId };
    }

    await markPaymentMatched(env, payment.id);
    const smsId = await logSms(env, message, amount, paidAt, "ok", payment.id);
    const txId = await createTransaction(env, payment, smsId, paidAt);

    if (payment.callback_url) {
        await fireCallback(env, txId, payment, paidAt);
    }

    return {
        parsed: true, matched: true, amount,
        order_id: payment.order_id, service: payment.service_name, tx_id: txId,
    };
}
