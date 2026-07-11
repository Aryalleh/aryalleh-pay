import { regenerateSmsToken } from "../../../lib/db.js";
import { redirectWithFlash } from "../../../lib/session.js";

export async function onRequestPost(context) {
    const { env } = context;
    const token = await regenerateSmsToken(env);
    return redirectWithFlash("/panel/settings", `توکن جدید SMS: ${token}`, "token");
}
