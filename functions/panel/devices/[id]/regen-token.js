import { regenerateDeviceToken } from "../../../../lib/db.js";
import { redirectWithFlash } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    const token = await regenerateDeviceToken(env, parseInt(params.id, 10));
    return redirectWithFlash("/panel/devices", `توکن جدید: ${token}`, "token");
}
