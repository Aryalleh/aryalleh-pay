import { getDeviceById, toggleDevice } from "../../../../lib/db.js";
import { redirect } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    const id = parseInt(params.id, 10);
    const device = await getDeviceById(env, id);
    if (device) await toggleDevice(env, id, !device.is_active);
    return redirect("/panel/devices");
}
