// functions/panel/_middleware.js — guards every /panel/* route.
// Forces a first-login password-set flow when no admin password exists yet,
// otherwise requires a valid session cookie (except for the login page itself).
import { isAdminPasswordSet, isSessionValid } from "../../lib/db.js";
import { getCookie, redirect, redirectWithFlash } from "../../lib/session.js";

export async function onRequest(context) {
    const { request, env, next } = context;
    const path = new URL(request.url).pathname;

    const passwordSet = await isAdminPasswordSet(env);

    if (path === "/panel/set-password") {
        return passwordSet ? redirect("/panel/login") : next();
    }

    if (!passwordSet) {
        return redirect("/panel/set-password");
    }

    if (path === "/panel/login") {
        return next();
    }

    const token = getCookie(request, "session");
    if (!(await isSessionValid(env, token))) {
        return redirectWithFlash("/panel/login", "لطفاً وارد شوید", "error");
    }

    return next();
}
