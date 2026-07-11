import { setSmsTokenRequired } from "../../../lib/db.js";
import { redirectWithFlash } from "../../../lib/session.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    const required = form.get("required") === "1";
    await setSmsTokenRequired(env, required);
    return redirectWithFlash(
        "/panel/settings",
        required ? "الزام کلید SMS فعال شد" : "الزام کلید SMS غیرفعال شد",
        "info"
    );
}
