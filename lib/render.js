// lib/render.js — shared HTML shell + small render helpers (RTL, Persian UI)
import { clearFlashCookieHeader } from "./session.js";

export function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const NAV_ITEMS = [
    { href: "/panel/", key: "dashboard", label: "داشبورد" },
    { href: "/panel/services", key: "services", label: "سرویس‌ها" },
    { href: "/panel/cards", key: "cards", label: "کارت‌ها" },
    { href: "/panel/payments", key: "payments", label: "پرداخت‌ها" },
    { href: "/panel/transactions", key: "transactions", label: "تراکنش‌ها" },
    { href: "/panel/settings", key: "settings", label: "تنظیمات" },
];

const STYLE = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  font-family: Tahoma, "Segoe UI", Vazirmatn, sans-serif;
  margin: 0; background: #0f1115; color: #e7e9ee;
}
a { color: #7cc4ff; }
header.top { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; background:#161a22; border-bottom:1px solid #262b36; }
header.top .brand { font-weight:bold; font-size:1.15rem; color:#fff; }
nav.tabs { display:flex; gap:4px; flex-wrap:wrap; padding:0 22px; background:#12151b; border-bottom:1px solid #262b36; }
nav.tabs a { padding:10px 14px; text-decoration:none; color:#aab2c5; border-bottom:2px solid transparent; font-size:.92rem; }
nav.tabs a.active { color:#fff; border-bottom-color:#4f8cff; }
main { max-width:1080px; margin:0 auto; padding:24px 18px 60px; }
.card-box { background:#161a22; border:1px solid #262b36; border-radius:10px; padding:18px; margin-bottom:18px; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; }
.stat { background:#161a22; border:1px solid #262b36; border-radius:10px; padding:16px; }
.stat .num { font-size:1.6rem; font-weight:bold; color:#fff; }
.stat .lbl { color:#9099ad; font-size:.85rem; margin-top:4px; }
table { width:100%; border-collapse:collapse; font-size:.9rem; }
th, td { padding:9px 10px; border-bottom:1px solid #262b36; text-align:right; }
th { color:#9099ad; font-weight:600; }
input[type=text], input[type=password], input[type=number], input[type=url], textarea, select {
  width:100%; padding:9px 10px; border-radius:6px; border:1px solid #333a48;
  background:#0f1115; color:#e7e9ee; font-family:inherit; margin-top:4px;
}
label { display:block; font-size:.85rem; color:#c3c9d8; margin-bottom:10px; }
button, .btn {
  background:#4f8cff; color:#fff; border:none; padding:8px 16px; border-radius:6px;
  cursor:pointer; font-size:.88rem; text-decoration:none; display:inline-block;
}
button.secondary, .btn.secondary { background:#2a2f3b; }
button.danger, .btn.danger { background:#c0392b; }
form.inline { display:inline; }
.badge { padding:2px 8px; border-radius:20px; font-size:.75rem; }
.badge.ok { background:#173a2b; color:#5fd08a; }
.badge.off { background:#3a1717; color:#e07a7a; }
.badge.pending { background:#3a341a; color:#e0c96f; }
.flash { padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:.9rem; }
.flash.info { background:#173a2b; color:#8de0ab; }
.flash.error { background:#3a1717; color:#f0a3a3; }
.flash.token { background:#1a2a3a; color:#8fc7ff; font-family:monospace; word-break:break-all; }
.mono { font-family:monospace; }
.muted { color:#9099ad; }
.checkbox-list { display:flex; flex-direction:column; gap:8px; }
.checkbox-list label { display:flex; align-items:center; gap:8px; font-size:.9rem; margin:0; }
.checkbox-list input { width:auto; margin:0; }
`;

export function pageShell({ title, activeNav = "", flash = null, body = "", showNav = true }) {
    const navHtml = showNav
        ? `<nav class="tabs">${NAV_ITEMS.map(
              (n) => `<a class="${n.key === activeNav ? "active" : ""}" href="${n.href}">${n.label}</a>`
          ).join("")}<a href="/panel/logout" style="margin-inline-start:auto">خروج</a></nav>`
        : "";
    const flashHtml = flash
        ? `<div class="flash ${esc(flash.type)}">${esc(flash.message)}</div>`
        : "";
    return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — AryallehPay</title>
<style>${STYLE}</style>
</head>
<body>
${showNav ? `<header class="top"><div class="brand">💳 AryallehPay</div></header>` : ""}
${navHtml}
<main>
${flashHtml}
${body}
</main>
</body>
</html>`;
}

export function htmlResponse(html, status = 200, extraHeaders = {}) {
    const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", ...extraHeaders });
    return new Response(html, { status, headers });
}

/** Renders a page and clears the flash cookie (call after reading it with readFlash). */
export function renderPage(opts, status = 200) {
    return htmlResponse(pageShell(opts), status, { "Set-Cookie": clearFlashCookieHeader() });
}

export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
        },
    });
}
