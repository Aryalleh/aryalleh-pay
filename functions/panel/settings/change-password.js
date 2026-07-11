import { verifyAdminPassword, setAdminPassword, deleteSession } from "../../../lib/db.js";
import { getCookie, clearSessionCookieHeader, flashCookieHeader, redirectWithFlash } from "../../../lib/session.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    const current = form.get("current_password") || "";
    const newPw = form.get("new_password") || "";
    const confirm = form.get("confirm_password") || "";

    if (!(await verifyAdminPassword(env, current))) {
        return redirectWithFlash("/panel/settings", "رمز فعلی اشتباه است", "error");
    }
    if (newPw.length < 6) {
        return redirectWithFlash("/panel/settings", "رمز جدید باید حداقل ۶ کاراکتر باشد", "error");
    }
    if (newPw !== confirm) {
        return redirectWithFlash("/panel/settings", "رمز جدید و تکرار آن یکسان نیستند", "error");
    }

    await setAdminPassword(env, newPw);
    await deleteSession(env, getCookie(request, "session"));

    const headers = new Headers({ Location: "/panel/login" });
    headers.append("Set-Cookie", clearSessionCookieHeader());
    headers.append("Set-Cookie", flashCookieHeader("رمز تغییر کرد — لطفاً دوباره وارد شوید", "info"));
    return new Response(null, { status: 302, headers });
}
