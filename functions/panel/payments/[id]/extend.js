// functions/panel/payments/[id]/extend.js — renew an expired/expiring
// pending payment's expiry so it becomes matchable again.
import { extendPaymentExpiry } from "../../../../lib/db.js";
import { redirectWithFlash } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const id = parseInt(params.id, 10);
    const form = await request.formData();
    const hours = Math.max(1, parseInt(form.get("hours"), 10) || 1);

    const newExpiresAt = await extendPaymentExpiry(env, id, hours);
    return redirectWithFlash("/panel/payments", `انقضای پرداخت #${id} تا ${newExpiresAt} تمدید شد`, "info");
}
