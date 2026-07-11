// functions/panel/transactions.js
import { getTransactions } from "../../lib/db.js";
import { readFlash } from "../../lib/session.js";
import { renderPage, esc } from "../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const [txs, flash] = [await getTransactions(env, 200), readFlash(request)];

    const rows = txs.map((t) => `
      <tr>
        <td>#${t.id}</td>
        <td>${esc(t.service_name)}</td>
        <td class="mono">${esc(t.order_id)}</td>
        <td>${Number(t.amount_rials).toLocaleString("en-US")} ریال</td>
        <td>${esc(t.paid_at || "—")}</td>
        <td><span class="badge ${t.callback_status === "success" ? "ok" : t.callback_status === "failed" ? "off" : "pending"}">${esc(t.callback_status)}</span></td>
      </tr>`).join("");

    return renderPage({
        title: "تراکنش‌ها",
        activeNav: "transactions",
        flash,
        body: `
<div class="card-box">
  <h3 style="margin-top:0">تراکنش‌های تأیید شده</h3>
  <table>
    <thead><tr><th>#</th><th>سرویس</th><th>سفارش</th><th>مبلغ</th><th>زمان پرداخت</th><th>وضعیت کال‌بک</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">هنوز تراکنشی ثبت نشده</td></tr>`}</tbody>
  </table>
</div>`,
    });
}
