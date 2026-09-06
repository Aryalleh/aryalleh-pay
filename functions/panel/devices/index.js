// functions/panel/devices/index.js — list + create SMS-forwarder devices (phones)
import { getDevices, createDevice, isDeviceOnline } from "../../../lib/db.js";
import { readFlash, redirectWithFlash } from "../../../lib/session.js";
import { renderPage, esc } from "../../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const [devices, flash] = [await getDevices(env), readFlash(request)];

    const rows = devices.map((d) => {
        const online = isDeviceOnline(d);
        return `
      <tr>
        <td>${esc(d.name)}</td>
        <td class="mono" style="font-size:.8rem">${esc(d.token)}</td>
        <td><span class="badge ${online ? "ok" : "off"}">${online ? "آنلاین" : "آفلاین"}</span></td>
        <td class="muted" style="white-space:nowrap">${esc(d.last_seen_at || "هرگز")}</td>
        <td><span class="badge ${d.is_active ? "ok" : "off"}">${d.is_active ? "فعال" : "غیرفعال"}</span></td>
        <td style="white-space:nowrap">
          <form class="inline" method="post" action="/panel/devices/${d.id}/toggle">
            <button class="secondary" type="submit">${d.is_active ? "غیرفعال کردن" : "فعال کردن"}</button>
          </form>
          <form class="inline" method="post" action="/panel/devices/${d.id}/regen-token">
            <button class="secondary" type="submit">توکن جدید</button>
          </form>
          <form class="inline" method="post" action="/panel/devices/${d.id}/delete" onsubmit="return confirm('این دستگاه حذف شود؟ سرویس‌هایی که به آن محدود شده‌اند، بدون‌محدودیت می‌شوند.')">
            <button class="danger" type="submit">حذف</button>
          </form>
        </td>
      </tr>`;
    }).join("");

    return renderPage({
        title: "دستگاه‌ها",
        activeNav: "devices",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">دستگاه جدید (گوشی اندروید)</h3>
  <p class="muted">برای هر گوشی که اپ ارسال پیامک روی آن نصب می‌شود، یک دستگاه جدید بسازید و توکن آن را در اپ همان گوشی وارد کنید.
  از پنل → سرویس‌ها → «تنظیمات مبلغ/انقضا» می‌توانید هر سرویس را به یک دستگاه خاص محدود کنید.</p>
  <form method="post" action="/panel/devices">
    <label>نام دستگاه <input type="text" name="name" placeholder="مثلاً: گوشی شماره ۱ - سامان" required></label>
    <button type="submit">ساخت دستگاه</button>
  </form>
</div>
<div class="card-box">
  <h3 style="margin-top:0">لیست دستگاه‌ها</h3>
  <table>
    <thead><tr><th>نام</th><th>توکن</th><th>وضعیت اتصال</th><th>آخرین اتصال</th><th>فعال/غیرفعال</th><th>عملیات</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">هنوز دستگاهی ساخته نشده</td></tr>`}</tbody>
  </table>
</div>`,
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const form = await request.formData();
    const name = (form.get("name") || "").trim();
    if (!name) return redirectWithFlash("/panel/devices", "نام دستگاه الزامی است", "error");

    const result = await createDevice(env, name);
    return redirectWithFlash("/panel/devices", `دستگاه ساخته شد | توکن: ${result.token}`, "token");
}
