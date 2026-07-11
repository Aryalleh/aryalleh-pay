// functions/panel/payments.js
import { getPendingPayments } from "../../lib/db.js";
import { readFlash } from "../../lib/session.js";
import { renderPage, esc } from "../../lib/render.js";

const STATUS_LABEL = { pending: "در انتظار", matched: "تأیید شده", expired: "منقضی", cancelled: "لغو شده" };
const STATUS_BADGE = { pending: "pending", matched: "ok", expired: "off", cancelled: "off" };

export async function onRequestGet(context) {
    const { request, env } = context;
    const [payments, flash] = [await getPendingPayments(env), readFlash(request)];

    const rows = payments.map((p) => `
      <tr>
        <td>#${p.id}</td>
        <td>${esc(p.service_name)}</td>
        <td class="mono">${esc(p.order_id)}</td>
        <td>${Number(p.amount_rials).toLocaleString("en-US")} ریال</td>
        <td><span class="badge ${STATUS_BADGE[p.status] || "pending"}">${esc(STATUS_LABEL[p.status] || p.status)}</span></td>
        <td class="muted">${esc(p.expires_at || "—")}</td>
        <td>
          ${p.status === "pending" ? `
          <form class="inline" method="post" action="/panel/payments/${p.id}/confirm" onsubmit="return confirm('این پرداخت به صورت دستی تأیید شود؟')">
            <input type="text" name="note" placeholder="یادداشت (اختیاری)" style="width:140px;display:inline-block;margin:0 6px">
            <button type="submit">تأیید دستی</button>
          </form>` : "—"}
        </td>
      </tr>`).join("");

    return renderPage({
        title: "پرداخت‌ها",
        activeNav: "payments",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">پرداخت‌های در انتظار و اخیر</h3>
  <table>
    <thead><tr><th>#</th><th>سرویس</th><th>سفارش</th><th>مبلغ</th><th>وضعیت</th><th>انقضا</th><th>عملیات</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" class="muted">پرداختی ثبت نشده</td></tr>`}</tbody>
  </table>
</div>`,
    });
}
