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
        <td class="muted" style="white-space:nowrap;font-size:.82rem">
          ${s.auto_adjust_amount ? "یکتاسازی خودکار" : "دستی (بدون تغییر)"}<br>
          انقضا: ${esc(s.default_expire_hours ?? 1)} ساعت
        </td>
        <td style="white-space:nowrap">
          <a class="btn secondary" href="/panel/services/${s.id}/settings">تنظیمات مبلغ/انقضا</a>
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
    <label style="display:flex;align-items:center;gap:6px">
      <input type="checkbox" name="auto_adjust_amount" value="1" checked style="width:auto;margin:0">
      <span>یکتاسازی خودکار مبلغ توسط درگاه (در صورت تداخل)</span>
    </label>
    <label>انقضای پیش‌فرض پرداخت (ساعت) <input type="number" name="default_expire_hours" min="1" max="720" value="1"></label>
    <button type="submit">ساخت سرویس</button>
  </form>
</div>
<div class="card-box">
  <h3 style="margin-top:0">لیست سرویس‌ها</h3>
  <table>
    <thead><tr><th>نام</th><th>توضیحات</th><th>توکن</th><th>وضعیت</th><th>مبلغ / انقضا</th><th>عملیات</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">هنوز سرویسی ساخته نشده</td></tr>`}</tbody>
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
    const autoAdjustAmount = form.get("auto_adjust_amount") === "1";
    const defaultExpireHours = Math.max(1, parseInt(form.get("default_expire_hours"), 10) || 1);

    if (!name) {
        return redirectWithFlash("/panel/services", "نام سرویس الزامی است", "error");
    }
    try {
        const result = await createService(env, name, description, callbackUrl, autoAdjustAmount, defaultExpireHours);
        return redirectWithFlash("/panel/services", `سرویس ساخته شد | توکن: ${result.token}`, "token");
    } catch (e) {
        return redirectWithFlash("/panel/services", `خطا: ${e.message || e}`, "error");
    }
}
