import { deleteSmsLogsInRange } from "../../../lib/db.js";
import { redirectWithFlash } from "../../../lib/session.js";

// <input type="datetime-local"> gives "YYYY-MM-DDTHH:MM" — convert to the
// "YYYY-MM-DD HH:MM:SS" format received_at is stored in.
function toStoredDatetime(value, secondsSuffix) {
    if (!value) return null;
    return value.replace("T", " ") + secondsSuffix;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    let from = toStoredDatetime(form.get("from"), ":00");
    let to = toStoredDatetime(form.get("to"), ":59");

    if (!from || !to) {
        return redirectWithFlash("/panel/sms", "بازهٔ زمانی نامعتبر است", "error");
    }
    if (from > to) [from, to] = [to, from];

    await deleteSmsLogsInRange(env, from, to);
    return redirectWithFlash("/panel/sms", `پیامک‌های بازهٔ ${from} تا ${to} حذف شدند`, "info");
}
