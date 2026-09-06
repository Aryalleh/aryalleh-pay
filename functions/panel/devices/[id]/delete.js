import { deleteDevice } from "../../../../lib/db.js";
import { redirectWithFlash } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    await deleteDevice(env, parseInt(params.id, 10));
    return redirectWithFlash("/panel/devices", "دستگاه حذف شد", "info");
}
