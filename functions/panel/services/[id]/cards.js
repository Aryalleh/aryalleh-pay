// functions/panel/services/[id]/cards.js — choose which cards this API key
// (service) is allowed to show on its checkout page.
import { getServiceById, getCards, getServiceCardIds, setServiceCards } from "../../../../lib/db.js";
import { readFlash, redirectWithFlash } from "../../../../lib/session.js";
import { renderPage, esc } from "../../../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const id = parseInt(params.id, 10);
    const svc = await getServiceById(env, id);
    if (!svc) return redirectWithFlash("/panel/services", "سرویس پیدا نشد", "error");

    const [allCards, selectedIds] = await Promise.all([
        getCards(env, false),
        getServiceCardIds(env, id),
    ]);
    const flash = readFlash(request);
    const unrestricted = selectedIds.length === 0;

    const rows = allCards.map((c) => `
      <label>
        <input type="checkbox" name="card_id" value="${c.id}" ${selectedIds.includes(c.id) ? "checked" : ""}>
        <span>${esc(c.label)} — <span class="mono">${esc(c.card_number)}</span> (${esc(c.owner_name)})${c.is_active ? "" : " <span class='badge off'>غیرفعال</span>"}</span>
      </label>`).join("");

    return renderPage({
        title: `کارت‌های مجاز — ${svc.name}`,
        activeNav: "services",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">کارت‌های مجاز برای «${esc(svc.name)}»</h3>
  <p class="muted">هیچ کدام از کارت‌ها را انتخاب نکنید تا این سرویس بدون محدودیت از همهٔ کارت‌های فعال استفاده کند.
  ${unrestricted ? "<br><b>وضعیت فعلی: بدون محدودیت (همهٔ کارت‌های فعال)</b>" : ""}</p>
  <form method="post">
    <div class="checkbox-list">${rows || `<span class="muted">هنوز کارتی ثبت نشده — از صفحهٔ کارت‌ها اضافه کنید</span>`}</div>
    <div style="margin-top:16px">
      <button type="submit">ذخیره</button>
      <a class="btn secondary" href="/panel/services">بازگشت</a>
    </div>
  </form>
</div>`,
    });
}

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const id = parseInt(params.id, 10);
    const svc = await getServiceById(env, id);
    if (!svc) return redirectWithFlash("/panel/services", "سرویس پیدا نشد", "error");

    const form = await request.formData();
    const cardIds = form.getAll("card_id").map((v) => parseInt(v, 10)).filter((v) => !Number.isNaN(v));

    await setServiceCards(env, id, cardIds);
    return redirectWithFlash(`/panel/services/${id}/cards`, "کارت‌های مجاز ذخیره شد", "info");
}
