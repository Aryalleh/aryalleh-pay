import { getServiceById, toggleService } from "../../../../lib/db.js";
import { redirect } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    const id = parseInt(params.id, 10);
    const svc = await getServiceById(env, id);
    if (svc) await toggleService(env, id, !svc.is_active);
    return redirect("/panel/services");
}
