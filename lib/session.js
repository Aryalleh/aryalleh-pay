// lib/session.js — cookie parsing, admin session cookie, and flash-message helpers
// (Pages Functions are stateless per request, so "flash" survives a redirect via
// a short-lived cookie instead of Flask's server-side session.)

export function getCookie(request, name) {
    const header = request.headers.get("Cookie") || "";
    const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(token, maxAge) {
    return `session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookieHeader() {
    return `session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function flashCookieHeader(message, type = "info") {
    const value = encodeURIComponent(JSON.stringify({ message, type }));
    return `flash=${value}; Path=/; Max-Age=15; HttpOnly; SameSite=Lax`;
}

export function clearFlashCookieHeader() {
    return `flash=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function readFlash(request) {
    const raw = getCookie(request, "flash");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** Redirect response carrying a flash message via cookie. */
export function redirectWithFlash(location, message, type = "info") {
    const headers = new Headers({ Location: location });
    headers.append("Set-Cookie", flashCookieHeader(message, type));
    return new Response(null, { status: 302, headers });
}

export function redirect(location) {
    return new Response(null, { status: 302, headers: { Location: location } });
}
