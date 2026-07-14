// functions/panel/settings/index.js
import { getBotSettings, getServices, getSmsToken, isSmsTokenRequired, isNotifyAllSmsEnabled } from "../../../lib/db.js";
import { readFlash } from "../../../lib/session.js";
import { renderPage, esc } from "../../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const [bot, services, smsToken, smsRequired, notifyAllSms, flash] = await Promise.all([
        getBotSettings(env), getServices(env), getSmsToken(env), isSmsTokenRequired(env), isNotifyAllSmsEnabled(env), Promise.resolve(readFlash(request)),
    ]);
    const origin = new URL(request.url).origin;

    return renderPage({
        title: "تنظیمات",
        activeNav: "settings",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">بات تلگرام</h3>
  <p class="muted">بات از طریق <b>Webhook</b> کار می‌کند (نه polling) تا با Cloudflare Pages سازگار باشد.
  با ذخیرهٔ تنظیمات، آدرس <span class="mono">${esc(origin)}/telegram/webhook</span> به‌طور خودکار روی تلگرام ثبت می‌شود.</p>
  <form method="post" action="/panel/settings/save-bot">
    <label>Bot Token <input type="text" name="bot_token" value="${esc(bot.bot_token || "")}" required></label>
    <label>Admin Chat ID <input type="text" name="admin_chat_id" value="${esc(bot.admin_chat_id || "")}" required></label>
    <label>Service Token برای بات (یکی از توکن‌های سرویس‌ها)
      <select name="service_token" required>
        <option value="">— انتخاب کنید —</option>
        ${services.map((s) => `<option value="${esc(s.token)}" ${bot.bot_service_token === s.token ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
      </select>
    </label>
    <button type="submit">ذخیره و ثبت Webhook</button>
  </form>
</div>

<div class="card-box">
  <h3 style="margin-top:0">کلید محرمانهٔ دریافت پیامک (SMS)</h3>
  <p class="muted">این کلید باید در هدر <span class="mono">Authorization: Bearer &lt;token&gt;</span> هنگام ارسال به
  <span class="mono">POST /api/sms/receive</span> استفاده شود.</p>
  <p>توکن فعلی: <span class="mono flash token" style="display:inline-block">${esc(smsToken)}</span></p>
  <form method="post" action="/panel/settings/regen-sms-token" style="margin-bottom:14px" onsubmit="return confirm('یک توکن جدید ساخته می‌شود و توکن قبلی از کار می‌افتد. ادامه می‌دهید؟')">
    <button class="secondary" type="submit">ساخت توکن جدید</button>
  </form>
  <form method="post" action="/panel/settings/toggle-sms-required">
    <label style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" name="required" value="1" style="width:auto" ${smsRequired ? "checked" : ""}>
      <span>الزامی بودن این کلید برای POST /api/sms/receive ${smsRequired ? "(فعال)" : "(غیرفعال — هر کسی می‌تواند بدون توکن پیامک ارسال کند)"}</span>
    </label>
    <button class="secondary" type="submit" style="margin-top:10px">اعمال</button>
  </form>
</div>

<div class="card-box">
  <h3 style="margin-top:0">لیسن تو ال (Listen to all)</h3>
  <p class="muted">وقتی فعال باشد، متن هر پیامکی که از طریق <span class="mono">POST /api/sms/receive</span>
  به سرور می‌رسد — چه پرداختی را تأیید کند چه نکند، حتی اگر اصلاً قابل تجزیه نباشد — مستقیماً برای ادمین در تلگرام ارسال می‌شود.
  (نیازمند تنظیم بات تلگرام در بالای همین صفحه است.)</p>
  <form method="post" action="/panel/settings/toggle-notify-all-sms">
    <label style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" name="enabled" value="1" style="width:auto" ${notifyAllSms ? "checked" : ""}>
      <span>ارسال متن همهٔ پیامک‌های دریافتی از API به ادمین ${notifyAllSms ? "(فعال)" : "(غیرفعال)"}</span>
    </label>
    <button class="secondary" type="submit" style="margin-top:10px">اعمال</button>
  </form>
</div>

<div class="card-box">
  <h3 style="margin-top:0">تغییر رمز عبور</h3>
  <form method="post" action="/panel/settings/change-password">
    <label>رمز فعلی <input type="password" name="current_password" required></label>
    <label>رمز جدید <input type="password" name="new_password" minlength="6" required></label>
    <label>تکرار رمز جدید <input type="password" name="confirm_password" minlength="6" required></label>
    <button type="submit">تغییر رمز</button>
  </form>
</div>`,
    });
}
