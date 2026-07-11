// GET /pay/:pay_token — customer-facing checkout page.
// Shows only the cards the originating service is scoped to (see
// service_cards / getCardsForService) — falls back to all active cards when
// a service has no explicit restriction.
import { getPaymentByToken, getCardsForService } from "../../lib/db.js";
import { htmlResponse, pageShell, esc } from "../../lib/render.js";

export async function onRequestGet(context) {
    const { params } = context;
    const payment = await getPaymentByToken(context.env, params.pay_token);
    if (!payment) return new Response("Not found", { status: 404 });

    const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (payment.expires_at && payment.expires_at < nowStr && payment.status === "pending") {
        return htmlResponse(pageShell({
            title: "پرداخت منقضی شد",
            showNav: false,
            body: `
<div class="card-box" style="max-width:420px;margin:60px auto;text-align:center">
  <h2>⏳ زمان این پرداخت به پایان رسیده</h2>
  <p class="muted">سفارش <span class="mono">${esc(payment.order_id)}</span> دیگر قابل پرداخت نیست.</p>
</div>`,
        }));
    }

    if (payment.status === "matched") {
        return htmlResponse(pageShell({
            title: "پرداخت موفق",
            showNav: false,
            body: `
<div class="card-box" style="max-width:420px;margin:60px auto;text-align:center">
  <h2>✅ پرداخت با موفقیت تأیید شد</h2>
  <p class="muted">سفارش <span class="mono">${esc(payment.order_id)}</span></p>
  ${payment.redirect_url ? `<p><a class="btn" href="${esc(payment.redirect_url)}">بازگشت به ${esc(payment.service_name)}</a></p>` : ""}
</div>`,
        }));
    }

    const cards = await getCardsForService(context.env, payment.service_id);
    const cardsHtml = cards.map((c) => `
      <div class="card-box" style="margin-bottom:10px">
        <div style="font-weight:bold">${esc(c.label)}</div>
        <div class="mono" style="font-size:1.1rem;margin:6px 0">${esc(c.card_number)}</div>
        <div class="muted" style="font-size:.85rem">شبا: <span class="mono">${esc(c.sheba)}</span></div>
        <div class="muted" style="font-size:.85rem">به نام: ${esc(c.owner_name)}</div>
      </div>`).join("") || `<p class="muted">در حال حاضر کارتی برای این سرویس فعال نیست. با پشتیبانی تماس بگیرید.</p>`;

    const body = `
<div class="card-box" style="max-width:480px;margin:30px auto;text-align:center">
  <h2 style="margin-top:0">پرداخت سفارش</h2>
  <p class="muted">سرویس: ${esc(payment.service_name)}</p>
  <p class="muted">سفارش: <span class="mono">${esc(payment.order_id)}</span></p>
  <div style="font-size:1.6rem;font-weight:bold;margin:16px 0">${Number(payment.amount_rials).toLocaleString("en-US")} ریال</div>
  ${payment.description ? `<p class="muted">${esc(payment.description)}</p>` : ""}
</div>
<div style="max-width:480px;margin:0 auto">
  <p class="muted" style="text-align:center">مبلغ دقیق بالا را به یکی از کارت‌های زیر واریز کنید:</p>
  ${cardsHtml}
  <p id="status" class="muted" style="text-align:center;margin-top:16px">⏳ در انتظار تأیید پرداخت...</p>
</div>
<script>
(function () {
  var token = ${JSON.stringify(params.pay_token)};
  function poll() {
    fetch('/api/pay/poll/' + token).then(function (r) { return r.json(); }).then(function (data) {
      if (!data.ok) return;
      if (data.status === 'matched') {
        document.getElementById('status').textContent = '✅ پرداخت تأیید شد';
        setTimeout(function () {
          if (data.redirect_url) window.location.href = data.redirect_url;
          else window.location.reload();
        }, 1200);
      } else {
        setTimeout(poll, 5000);
      }
    }).catch(function () { setTimeout(poll, 5000); });
  }
  setTimeout(poll, 5000);
})();
</script>`;

    return htmlResponse(pageShell({ title: "پرداخت", showNav: false, body }));
}
