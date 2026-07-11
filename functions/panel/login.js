// functions/panel/login.js
import { verifyAdminPassword, createSession } from "../../lib/db.js";
import { readFlash, redirectWithFlash, sessionCookieHeader } from "../../lib/session.js";
import { renderPage } from "../../lib/render.js";

export async function onRequestGet(context) {
    const { request } = context;
    const flash = readFlash(request);
    return renderPage({
        title: "ورود",
        showNav: false,
        flash,
        body: `
<div class="card-box" style="max-width:380px;margin:60px auto;">
  <h2 style="margin-top:0">ورود به پنل</h2>
  <form method="post">
    <label>رمز عبور
      <input type="password" name="password" required autofocus>
    </label>
    <button type="submit">ورود</button>
  </form>
</div>`,
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    const password = form.get("password") || "";

    if (await verifyAdminPassword(env, password)) {
        const { token, maxAge } = await createSession(env);
        const headers = new Headers({ Location: "/panel/" });
        headers.append("Set-Cookie", sessionCookieHeader(token, maxAge));
        return new Response(null, { status: 302, headers });
    }

    return redirectWithFlash("/panel/login", "رمز اشتباه است", "error");
}
