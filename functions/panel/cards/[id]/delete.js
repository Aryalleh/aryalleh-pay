import { deleteCard } from "../../../../lib/db.js";
import { redirectWithFlash } from "../../../../lib/session.js";

export async function onRequestPost(context) {
    const { env, params } = context;
    await deleteCard(env, parseInt(params.id, 10));
    return redirectWithFlash("/panel/cards", "کارت حذف شد", "info");
}
