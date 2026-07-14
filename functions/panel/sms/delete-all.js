import { deleteAllSmsLogs } from "../../../lib/db.js";
import { redirectWithFlash } from "../../../lib/session.js";

export async function onRequestPost(context) {
    const { env } = context;
    await deleteAllSmsLogs(env);
    return redirectWithFlash("/panel/sms", "همهٔ پیامک‌های آرشیو حذف شدند", "info");
}
