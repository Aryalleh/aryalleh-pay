// functions/panel/cards/index.js — list + create bank cards
import { getCards, createCard } from "../../../lib/db.js";
import { readFlash, redirectWithFlash } from "../../../lib/session.js";
import { renderPage, esc } from "../../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const [cards, flash] = [await getCards(env, false), readFlash(request)];

    const rows = cards.map((c) => `
      <tr>
        <td>${esc(c.label)}</td>
        <td class="mono">${esc(c.card_number)}</td>
        <td class="mono">${esc(c.sheba)}</td>
        <td>${esc(c.owner_name)}</td>
        <td><span class="badge ${c.is_active ? "ok" : "off"}">${c.is_active ? "فعال" : "غیرفعال"}</span></td>
        <td style="white-space:nowrap">
          <form class="inline" method="post" action="/panel/cards/${c.id}/toggle">
            <button class="secondary" type="submit">${c.is_active ? "غیرفعال کردن" : "فعال کردن"}</button>
          </form>
          <form class="inline" method="post" action="/panel/cards/${c.id}/delete" onsubmit="return confirm('حذف این کارت؟')">
            <button class="danger" type="submit">حذف</button>
          </form>
        </td>
      </tr>`).join("");

    return renderPage({
        title: "کارت‌ها",
        activeNav: "cards",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">افزودن کارت جدید</h3>
  <form method="post" action="/panel/cards">
    <label>عنوان <input type="text" name="label" required></label>
    <label>شماره کارت <input type="text" name="card_number" required></label>
    <label>شبا <input type="text" name="sheba" required></label>
    <label>نام صاحب حساب <input type="text" name="owner_name" required></label>
    <button type="submit">افزودن کارت</button>
  </form>
</div>
<div class="card-box">
  <h3 style="margin-top:0">لیست کارت‌ها</h3>
  <table>
    <thead><tr><th>عنوان</th><th>شماره کارت</th><th>شبا</th><th>صاحب حساب</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">هنوز کارتی ثبت نشده</td></tr>`}</tbody>
  </table>
  <p class="muted" style="margin-top:12px">برای محدود کردن یک سرویس (API Key) به کارت‌های خاص، از صفحهٔ «سرویس‌ها» گزینهٔ «کارت‌های مجاز» را استفاده کنید.</p>
</div>`,
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    const label = (form.get("label") || "").trim();
    const cardNumber = (form.get("card_number") || "").trim().replace(/-/g, "").replace(/\s/g, "");
    const sheba = (form.get("sheba") || "").trim();
    const ownerName = (form.get("owner_name") || "").trim();

    if (!label || !cardNumber || !sheba || !ownerName) {
        return redirectWithFlash("/panel/cards", "همه فیلدها الزامی هستند", "error");
    }
    await createCard(env, label, cardNumber, sheba, ownerName);
    return redirectWithFlash("/panel/cards", "کارت اضافه شد", "info");
}
