import { deleteService } from "../../../../lib/db.js";
import { redirectWithFlash } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    await deleteService(env, parseInt(params.id, 10));
    return redirectWithFlash("/panel/services", "سرویس حذف شد", "info");
}
