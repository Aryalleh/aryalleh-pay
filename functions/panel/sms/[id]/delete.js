import { deleteSmsLog } from "../../../../lib/db.js";
import { redirectWithFlash } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    await deleteSmsLog(env, parseInt(params.id, 10));
    return redirectWithFlash("/panel/sms", "پیامک حذف شد", "info");
}
