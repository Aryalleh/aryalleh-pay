import { regenerateServiceToken } from "../../../../lib/db.js";
import { redirectWithFlash } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    const token = await regenerateServiceToken(env, parseInt(params.id, 10));
    return redirectWithFlash("/panel/services", `توکن جدید: ${token}`, "token");
}
