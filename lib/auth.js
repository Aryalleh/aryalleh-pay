// lib/auth.js — shared Bearer-token auth for the public API
import { getServiceByToken } from "./db.js";

export async function authService(request, env) {
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7).trim();
    return await getServiceByToken(env, token);
}

export function unauthorized() {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
    });
}
