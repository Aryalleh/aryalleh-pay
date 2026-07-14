import { setNotifyAllSms } from "../../../lib/db.js";
import { redirectWithFlash } from "../../../lib/session.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    const enabled = form.get("enabled") === "1";
    await setNotifyAllSms(env, enabled);
    return redirectWithFlash(
        "/panel/settings",
        enabled ? "لیسن تو ال فعال شد" : "لیسن تو ال غیرفعال شد",
        "info"
    );
}
