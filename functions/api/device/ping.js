// POST /api/device/ping — Authorization: Bearer <device_token>
// Lightweight heartbeat the Android app can call periodically (independent
// of actually forwarding an SMS) so a device shows "online" in the panel
// even during a lull with no incoming bank SMS. Older app builds that never
// call this still show reasonable status, since /api/sms/receive also
// updates last_seen_at on every real SMS from a recognized device token.
import { getDeviceByToken, touchDeviceLastSeen } from "../../../lib/db.js";
import { jsonResponse } from "../../../lib/render.js";
import { unauthorized } from "../../../lib/auth.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    const device = token ? await getDeviceByToken(env, token) : null;
    if (!device) return unauthorized();

    await touchDeviceLastSeen(env, device.id);
    return jsonResponse({ ok: true, device: device.name });
}

export async function onRequestOptions() {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}
