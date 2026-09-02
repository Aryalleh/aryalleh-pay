// functions/panel/reconcile.js — GET renders an upload page that extracts
// deposit rows from a Blu Bank statement PDF entirely client-side (pdf.js,
// vendored under /vendor/pdfjs/), then POSTs the extracted amounts to
// /panel/reconcile/apply to auto-confirm any still-pending payment whose
// amount shows up as a deposit in the statement. Fallback path for when the
// SMS-forwarding app didn't catch a payment.
import { readFlash } from "../../lib/session.js";
import { renderPage } from "../../lib/render.js";

export async function onRequestGet(context) {
    const { request } = context;
    const flash = readFlash(request);

    const body = `
<div class="card-box">
  <h3 style="margin-top:0">تطبیق خودکار با صورتحساب بانکی (بلو بانک)</h3>
  <p class="muted">
    برای وقت‌هایی که پیامک بانکی نرسیده یا اپ اندروید کار نکرده: فایل PDF صورتحساب
    (پرینت حساب) بانک بلو را همینجا آپلود کنید. کل پردازش فایل <b>در همین مرورگر شما</b>
    انجام می‌شود و فقط فهرست مبالغ واریزی به سرور فرستاده می‌شود، نه خود فایل.
    سیستم به‌صورت خودکار هر پرداخت در انتظاری که مبلغش در صورتحساب دیده شود را تأیید می‌کند.
  </p>
  <label>فایل PDF صورتحساب <input type="file" id="pdf-input" accept="application/pdf"></label>
  <button type="button" id="run-btn" disabled>بررسی و تطبیق خودکار</button>
  <p id="status" class="muted" style="margin-top:12px"></p>
</div>
<div id="results"></div>

<script type="module">
import * as pdfjsLib from "/vendor/pdfjs/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";

function toNumber(str) {
  const cleaned = str.replace(/[,،٬]/g, "").trim();
  if (!/^\\d+$/.test(cleaned)) return null;
  return parseInt(cleaned, 10);
}

async function extractPage(page) {
  const content = await page.getTextContent();
  const allItems = content.items
    .filter((it) => it.str.trim() !== "")
    .map((it) => ({ str: it.str.normalize("NFKC").trim(), x: it.transform[4], y: it.transform[5] }));

  // Column layout is position-based, not reading-order based (this PDF's
  // text extraction reorders RTL content unpredictably) — the header row's
  // x marks where data rows begin; each header column's y marks that
  // column's horizontal band, reused below to bucket every row's cells.
  const headerItem = allItems.find((it) => it.str.includes("ردیف"));
  if (!headerItem) return [];
  const items = allItems.filter((it) => it.x > headerItem.x + 5);
  items.sort((a, b) => a.x - b.x);

  const rows = [];
  let cur = [];
  let lastX = null;
  for (const it of items) {
    if (lastX !== null && it.x - lastX > 15) {
      rows.push(cur);
      cur = [];
    }
    cur.push(it);
    lastX = it.x;
  }
  if (cur.length) rows.push(cur);

  const results = [];
  for (const row of rows) {
    const find = (yMin, yMax) => row.find((it) => it.y >= yMin && it.y <= yMax);
    const rowNumItem = find(780, 800);
    if (!rowNumItem) continue;
    const dateItem = find(725, 745);
    const depositItem = find(235, 270);
    results.push({
      row: rowNumItem.str,
      date: dateItem ? dateItem.str : null,
      deposit: depositItem ? toNumber(depositItem.str) : null,
    });
  }
  return results;
}

const fileInput = document.getElementById("pdf-input");
const runBtn = document.getElementById("run-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

fileInput.addEventListener("change", () => { runBtn.disabled = !fileInput.files.length; });

runBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  runBtn.disabled = true;
  resultsEl.innerHTML = "";
  statusEl.textContent = "⏳ در حال خواندن فایل PDF...";

  try {
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    let allRows = [];
    for (let p = 1; p <= doc.numPages; p++) {
      statusEl.textContent = \`⏳ در حال پردازش صفحه \${p} از \${doc.numPages}...\`;
      const page = await doc.getPage(p);
      allRows = allRows.concat(await extractPage(page));
    }

    const deposits = allRows.filter((r) => r.deposit && r.deposit > 0);
    if (!deposits.length) {
      statusEl.textContent = "⚠️ هیچ ردیف واریزی در این فایل پیدا نشد. فرمت فایل با بلو بانک تطبیق ندارد یا فایل خالی است.";
      runBtn.disabled = false;
      return;
    }

    statusEl.textContent = \`⏳ \${deposits.length} واریزی پیدا شد، در حال تطبیق با پرداخت‌های در انتظار...\`;

    const resp = await fetch("/panel/reconcile/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deposits: deposits.map((d) => ({ amount: d.deposit, row: d.row, date: d.date })) }),
    });
    const data = await resp.json();
    if (!data.ok) {
      statusEl.textContent = "خطا: " + (data.error || "نامشخص");
      runBtn.disabled = false;
      return;
    }

    statusEl.textContent = \`✅ انجام شد — \${data.matched.length} پرداخت تأیید شد از \${deposits.length} واریزی موجود در صورتحساب.\`;
    renderResults(data);
  } catch (e) {
    statusEl.textContent = "خطا در پردازش فایل: " + (e.message || e);
  } finally {
    runBtn.disabled = false;
  }
});

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

function renderResults(data) {
  resultsEl.innerHTML = "";

  const box1 = el("div", null, "card-box");
  box1.appendChild(el("h3", \`پرداخت‌های تأیید‌شده خودکار (\${data.matched.length})\`));
  if (data.matched.length) {
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["سرویس", "سفارش", "مبلغ", "شماره تراکنش"].forEach((h) => headRow.appendChild(el("th", h)));
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const m of data.matched) {
      const tr = document.createElement("tr");
      tr.appendChild(el("td", m.service_name));
      tr.appendChild(el("td", m.order_id, "mono"));
      tr.appendChild(el("td", Number(m.amount_rials).toLocaleString("en-US") + " ریال"));
      tr.appendChild(el("td", "#" + m.tx_id));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    box1.appendChild(table);
  } else {
    box1.appendChild(el("p", "هیچ پرداخت در انتظاری با واریزی‌های این صورتحساب مطابقت نداشت.", "muted"));
  }
  resultsEl.appendChild(box1);

  const box2 = el("div", null, "card-box");
  box2.appendChild(el("h3", \`پرداخت‌های همچنان در انتظار (\${data.still_pending.length})\`));
  if (data.still_pending.length) {
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["سرویس", "سفارش", "مبلغ"].forEach((h) => headRow.appendChild(el("th", h)));
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const p of data.still_pending) {
      const tr = document.createElement("tr");
      tr.appendChild(el("td", p.service_name));
      tr.appendChild(el("td", p.order_id, "mono"));
      tr.appendChild(el("td", Number(p.amount_rials).toLocaleString("en-US") + " ریال"));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    box2.appendChild(table);
  } else {
    box2.appendChild(el("p", "همهٔ پرداخت‌های در انتظار تأیید شدند.", "muted"));
  }
  resultsEl.appendChild(box2);
}
</script>`;

    return renderPage({ title: "تطبیق صورتحساب", activeNav: "reconcile", flash, body });
}
