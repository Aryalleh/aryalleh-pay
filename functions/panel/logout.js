// functions/panel/logout.js
import { deleteSession } from "../../lib/db.js";
import { getCookie, clearSessionCookieHeader, flashCookieHeader } from "../../lib/session.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const token = getCookie(request, "session");
    await deleteSession(env, token);

    const headers = new Headers({ Location: "/panel/login" });
    headers.append("Set-Cookie", clearSessionCookieHeader());
    headers.append("Set-Cookie", flashCookieHeader("با موفقیت خارج شدید", "info"));
    return new Response(null, { status: 302, headers });
}
