// functions/panel/sms/index.js — SMS archive: every incoming SMS ever
// received via POST /api/sms/receive or the Telegram webhook, with
// single/range/all delete tools.
import { getSmsLogs } from "../../../lib/db.js";
import { readFlash } from "../../../lib/session.js";
import { renderPage, esc } from "../../../lib/render.js";

const PARSE_LABEL = { ok: "مبلغ تشخیص داده شد", failed: "قابل تجزیه نبود", manual: "تأیید دستی" };
const PARSE_BADGE = { ok: "ok", failed: "off", manual: "pending" };

export async function onRequestGet(context) {
    const { request, env } = context;
    const [logs, flash] = [await getSmsLogs(env), readFlash(request)];

    const rows = logs.map((l) => `
      <tr>
        <td>#${l.id}</td>
        <td style="white-space:normal;max-width:360px;min-width:220px">${esc(l.raw_message)}</td>
        <td>${l.amount_rials != null ? Number(l.amount_rials).toLocaleString("en-US") + " ریال" : "—"}</td>
        <td><span class="badge ${PARSE_BADGE[l.parse_status] || "off"}">${esc(PARSE_LABEL[l.parse_status] || l.parse_status)}</span></td>
        <td class="muted">${l.matched_payment_id ? `#${l.matched_payment_id}` : "—"}</td>
        <td class="muted" style="white-space:nowrap">${esc(l.received_at)}</td>
        <td style="white-space:nowrap">
          <form class="inline" method="post" action="/panel/sms/${l.id}/delete" onsubmit="return confirm('این پیامک حذف شود؟')">
            <button class="danger" type="submit">حذف</button>
          </form>
        </td>
      </tr>`).join("");

    return renderPage({
        title: "آرشیو پیامک‌ها",
        activeNav: "sms",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">حذف گروهی</h3>
  <div style="display:flex;gap:24px;flex-wrap:wrap">
    <form method="post" action="/panel/sms/delete-range" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap" onsubmit="return confirm('پیامک‌های این بازه حذف شوند؟')">
      <label style="margin:0">از تاریخ
        <input type="datetime-local" name="from" required>
      </label>
      <label style="margin:0">تا تاریخ
        <input type="datetime-local" name="to" required>
      </label>
      <button class="secondary" type="submit" style="height:38px">حذف بازهٔ زمانی</button>
    </form>
    <form method="post" action="/panel/sms/delete-all" onsubmit="return confirm('همهٔ پیامک‌های آرشیو حذف شوند؟ این عمل قابل بازگشت نیست.')">
      <button class="danger" type="submit" style="height:38px">حذف همهٔ پیامک‌ها</button>
    </form>
  </div>
</div>
<div class="card-box">
  <h3 style="margin-top:0">پیامک‌های دریافتی (${logs.length})</h3>
  <table>
    <thead><tr><th>#</th><th>متن پیامک</th><th>مبلغ</th><th>وضعیت</th><th>پرداخت مرتبط</th><th>زمان دریافت</th><th>عملیات</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" class="muted">هنوز پیامکی دریافت نشده</td></tr>`}</tbody>
  </table>
</div>`,
    });
}
