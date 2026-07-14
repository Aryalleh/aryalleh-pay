// functions/panel/payments.js
import { getPendingPayments } from "../../lib/db.js";
import { readFlash } from "../../lib/session.js";
import { renderPage, esc } from "../../lib/render.js";

const STATUS_LABEL = { pending: "در انتظار", matched: "تأیید شده", expired: "منقضی", cancelled: "لغو شده" };
const STATUS_BADGE = { pending: "pending", matched: "ok", expired: "off", cancelled: "off" };

export async function onRequestGet(context) {
    const { request, env } = context;
    const [payments, flash] = [await getPendingPayments(env), readFlash(request)];
    const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
    const origin = new URL(request.url).origin;

    const rows = payments.map((p) => {
        const isExpired = p.status === "pending" && p.expires_at && p.expires_at < nowStr;
        const effectiveStatus = isExpired ? "expired" : p.status;
        const payUrl = `${origin}/pay/${p.pay_token}`;
        return `
      <tr>
        <td>#${p.id}</td>
        <td>${esc(p.service_name)}</td>
        <td class="mono">${esc(p.order_id)}</td>
        <td>${Number(p.amount_rials).toLocaleString("en-US")} ریال</td>
        <td><span class="badge ${STATUS_BADGE[effectiveStatus] || "pending"}">${esc(STATUS_LABEL[effectiveStatus] || effectiveStatus)}</span></td>
        <td class="muted">${esc(p.expires_at || "—")}</td>
        <td style="white-space:nowrap">
          <a class="mono" href="/pay/${esc(p.pay_token)}" target="_blank" rel="noopener" title="${esc(payUrl)}" style="font-size:.78rem">
            /pay/${esc(p.pay_token.slice(0, 8))}…</a>
          <button class="secondary" type="button" style="margin-inline-start:6px;padding:3px 9px;font-size:.75rem"
            onclick="navigator.clipboard.writeText('${esc(payUrl)}').then(()=>{this.textContent='کپی شد!';setTimeout(()=>this.textContent='کپی',1200)})">کپی لینک کامل</button>
        </td>
        <td style="white-space:nowrap">
          ${p.status === "pending" ? `
          <form class="inline" method="post" action="/panel/payments/${p.id}/confirm" onsubmit="return confirm('این پرداخت به صورت دستی تأیید شود؟')">
            <input type="text" name="note" placeholder="یادداشت (اختیاری)" style="width:120px;display:inline-block;margin:0 6px">
            <button type="submit">تأیید دستی</button>
          </form>
          <form class="inline" method="post" action="/panel/payments/${p.id}/extend">
            <input type="number" name="hours" min="1" max="720" value="1" style="width:56px;display:inline-block;margin:0 6px">
            <button class="secondary" type="submit">${isExpired ? "تمدید انقضا" : "تمدید"}</button>
          </form>` : "—"}
        </td>
      </tr>`;
    }).join("");

    return renderPage({
        title: "پرداخت‌ها",
        activeNav: "payments",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">پرداخت‌های در انتظار و اخیر</h3>
  <table>
    <thead><tr><th>#</th><th>سرویس</th><th>سفارش</th><th>مبلغ</th><th>وضعیت</th><th>انقضا</th><th>لینک پرداخت</th><th>عملیات</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="8" class="muted">پرداختی ثبت نشده</td></tr>`}</tbody>
  </table>
</div>`,
    });
}
