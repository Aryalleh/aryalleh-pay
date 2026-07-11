// functions/panel/services/index.js — list + create services (API keys)
import { getServices, createService } from "../../../lib/db.js";
import { readFlash, redirectWithFlash } from "../../../lib/session.js";
import { renderPage, esc } from "../../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const [services, flash] = [await getServices(env), readFlash(request)];

    const rows = services.map((s) => `
      <tr>
        <td>${esc(s.name)}</td>
        <td class="muted">${esc(s.description || "—")}</td>
        <td class="mono" style="font-size:.8rem">${esc(s.token)}</td>
        <td><span class="badge ${s.is_active ? "ok" : "off"}">${s.is_active ? "فعال" : "غیرفعال"}</span></td>
        <td style="white-space:nowrap">
          <a class="btn secondary" href="/panel/services/${s.id}/cards">کارت‌های مجاز</a>
          <form class="inline" method="post" action="/panel/services/${s.id}/toggle">
            <button class="secondary" type="submit">${s.is_active ? "غیرفعال کردن" : "فعال کردن"}</button>
          </form>
          <form class="inline" method="post" action="/panel/services/${s.id}/regen-token">
            <button class="secondary" type="submit">توکن جدید</button>
          </form>
          <form class="inline" method="post" action="/panel/services/${s.id}/delete" onsubmit="return confirm('حذف این سرویس؟')">
            <button class="danger" type="submit">حذف</button>
          </form>
        </td>
      </tr>`).join("");

    return renderPage({
        title: "سرویس‌ها",
        activeNav: "services",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">سرویس جدید (API Key)</h3>
  <form method="post" action="/panel/services">
    <label>نام <input type="text" name="name" required></label>
    <label>توضیحات <input type="text" name="description"></label>
    <label>Callback URL <input type="url" name="callback_url" placeholder="https://..."></label>
    <button type="submit">ساخت سرویس</button>
  </form>
</div>
<div class="card-box">
  <h3 style="margin-top:0">لیست سرویس‌ها</h3>
  <table>
    <thead><tr><th>نام</th><th>توضیحات</th><th>توکن</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted">هنوز سرویسی ساخته نشده</td></tr>`}</tbody>
  </table>
</div>`,
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    const name = (form.get("name") || "").trim();
    const description = (form.get("description") || "").trim();
    const callbackUrl = (form.get("callback_url") || "").trim();

    if (!name) {
        return redirectWithFlash("/panel/services", "نام سرویس الزامی است", "error");
    }
    try {
        const result = await createService(env, name, description, callbackUrl);
        return redirectWithFlash("/panel/services", `سرویس ساخته شد | توکن: ${result.token}`, "token");
    } catch (e) {
        return redirectWithFlash("/panel/services", `خطا: ${e.message || e}`, "error");
    }
}
