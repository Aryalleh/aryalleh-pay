// functions/panel/set-password.js — first-login password setup.
// Reachable only while no admin password exists yet (enforced by _middleware.js).
import { isAdminPasswordSet, setAdminPassword, createSession } from "../../lib/db.js";
import { readFlash, redirectWithFlash, sessionCookieHeader } from "../../lib/session.js";
import { renderPage } from "../../lib/render.js";

export async function onRequestGet(context) {
    const { request } = context;
    const flash = readFlash(request);
    return renderPage({
        title: "تنظیم رمز عبور",
        showNav: false,
        flash,
        body: `
<div class="card-box" style="max-width:420px;margin:60px auto;">
  <h2 style="margin-top:0">خوش آمدید 👋</h2>
  <p class="muted">این اولین ورود شماست. یک رمز عبور برای پنل مدیریت تعیین کنید.</p>
  <form method="post">
    <label>رمز عبور جدید
      <input type="password" name="password" minlength="6" required autofocus>
    </label>
    <label>تکرار رمز عبور
      <input type="password" name="confirm" minlength="6" required>
    </label>
    <button type="submit">تنظیم رمز و ورود</button>
  </form>
</div>`,
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    // Defense in depth: refuse if a password already got set concurrently.
    if (await isAdminPasswordSet(env)) {
        return redirectWithFlash("/panel/login", "رمز قبلاً تنظیم شده است", "error");
    }

    const form = await request.formData();
    const password = form.get("password") || "";
    const confirm = form.get("confirm") || "";

    if (password.length < 6) {
        return redirectWithFlash("/panel/set-password", "رمز باید حداقل ۶ کاراکتر باشد", "error");
    }
    if (password !== confirm) {
        return redirectWithFlash("/panel/set-password", "رمز و تکرار آن یکسان نیستند", "error");
    }

    await setAdminPassword(env, password);
    const { token, maxAge } = await createSession(env);
    const headers = new Headers({ Location: "/panel/" });
    headers.append("Set-Cookie", sessionCookieHeader(token, maxAge));
    return new Response(null, { status: 302, headers });
}
