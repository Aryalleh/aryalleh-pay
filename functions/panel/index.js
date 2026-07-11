// functions/panel/index.js — dashboard
import { getStats, getTransactions } from "../../lib/db.js";
import { readFlash } from "../../lib/session.js";
import { renderPage, esc } from "../../lib/render.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const [stats, txs] = await Promise.all([getStats(env), getTransactions(env, 10)]);
    const flash = readFlash(request);

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
        title: "داشبورد",
        activeNav: "dashboard",
        flash,
        body: `
<div class="grid" style="margin-bottom:22px">
  <div class="stat"><div class="num">${stats.total_transactions}</div><div class="lbl">کل تراکنش‌ها</div></div>
  <div class="stat"><div class="num">${Number(stats.total_amount_rials).toLocaleString("en-US")}</div><div class="lbl">مجموع مبلغ (ریال)</div></div>
  <div class="stat"><div class="num">${stats.pending_payments}</div><div class="lbl">پرداخت‌های در انتظار</div></div>
  <div class="stat"><div class="num">${stats.active_services}</div><div class="lbl">سرویس‌های فعال</div></div>
</div>
<div class="card-box">
  <h3 style="margin-top:0">آخرین تراکنش‌ها</h3>
  <table>
    <thead><tr><th>#</th><th>سرویس</th><th>سفارش</th><th>مبلغ</th><th>زمان پرداخت</th><th>وضعیت کال‌بک</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">هنوز تراکنشی ثبت نشده</td></tr>`}</tbody>
  </table>
</div>`,
    });
}
