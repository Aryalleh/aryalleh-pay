import { getCardById, toggleCard } from "../../../../lib/db.js";
import { redirect } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    const id = parseInt(params.id, 10);
    const card = await getCardById(env, id);
    if (card) await toggleCard(env, id, !card.is_active);
    return redirect("/panel/cards");
}
