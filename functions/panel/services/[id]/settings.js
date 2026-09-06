// functions/panel/services/[id]/settings.js — per-service amount/expiry policy
import { getServiceById, updateServiceSettings, getDevices, setServiceDevice, isDeviceOnline } from "../../../../lib/db.js";
import { readFlash, redirectWithFlash } from "../../../../lib/session.js";
import { renderPage, esc } from "../../../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const id = parseInt(params.id, 10);
    const svc = await getServiceById(env, id);
    if (!svc) return redirectWithFlash("/panel/services", "سرویس پیدا نشد", "error");

    const [devices, flash] = [await getDevices(env), readFlash(request)];

    const deviceOptions = devices.map((d) => `
      <option value="${d.id}" ${svc.device_id === d.id ? "selected" : ""}>
        ${esc(d.name)} ${isDeviceOnline(d) ? "(آنلاین)" : "(آفلاین)"}${d.is_active ? "" : " — غیرفعال"}
      </option>`).join("");

    return renderPage({
        title: `تنظیمات مبلغ/انقضا — ${svc.name}`,
        activeNav: "services",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">تنظیمات مبلغ و انقضا برای «${esc(svc.name)}»</h3>
  <form method="post">
    <label style="display:flex;align-items:center;gap:6px">
      <input type="checkbox" name="auto_adjust_amount" value="1" style="width:auto;margin:0" ${svc.auto_adjust_amount ? "checked" : ""}>
      <span>یکتاسازی خودکار مبلغ توسط درگاه</span>
    </label>
    <p class="muted" style="margin-top:-6px">
      روشن: اگر مبلغ درخواستی الان روی یک سفارش دیگه در انتظار باشد، درگاه خودش چند ریال بهش اضافه می‌کند تا یکتا شود.
      خاموش: در این حالت مسئولیت یکتا بودن مبلغ با خود سایت فروشنده است؛ در صورت تداخل درگاه خطای <span class="mono">amount_conflict</span> برمی‌گرداند.
    </p>
    <label>انقضای پرداخت (ساعت)
      <input type="number" name="default_expire_hours" min="1" max="720" value="${esc(svc.default_expire_hours ?? 1)}">
    </label>
    <p class="muted" style="margin-top:-6px">
      همیشه همین مقدار برای پرداخت‌های این سرویس استفاده می‌شود — حتی اگر خود سرویس هنگام ساخت پرداخت مقدار
      <span class="mono">expires_minutes</span> بفرستد، نادیده گرفته می‌شود.
    </p>
    <label>دستگاه اختصاصی (اپ اندروید)
      <select name="device_id">
        <option value="">— بدون محدودیت (هر دستگاهی) —</option>
        ${deviceOptions}
      </select>
    </label>
    <p class="muted" style="margin-top:-6px">
      اگر یک دستگاه انتخاب کنید، این سرویس فقط با پیامک‌هایی که از همان گوشی می‌رسند تطبیق داده می‌شود، و یکتاسازی مبلغ
      هم فقط در بین سرویس‌های همان دستگاه (+ سرویس‌های بدون محدودیت) بررسی می‌شود — نه کل درگاه. برای مدیریت دستگاه‌ها به
      <a href="/panel/devices">پنل → دستگاه‌ها</a> بروید.
    </p>
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
    const autoAdjustAmount = form.get("auto_adjust_amount") === "1";
    const defaultExpireHours = Math.max(1, parseInt(form.get("default_expire_hours"), 10) || 1);
    const deviceIdRaw = form.get("device_id");
    const deviceId = deviceIdRaw ? parseInt(deviceIdRaw, 10) : null;

    await updateServiceSettings(env, id, autoAdjustAmount, defaultExpireHours);
    await setServiceDevice(env, id, deviceId);
    return redirectWithFlash(`/panel/services/${id}/settings`, "تنظیمات ذخیره شد", "info");
}
