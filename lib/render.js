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
    { href: "/panel/sms", key: "sms", label: "آرشیو پیامک‌ها" },
    { href: "/panel/settings", key: "settings", label: "تنظیمات" },
];

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap');

:root {
  color-scheme: dark;
  --bg: #020617;
  --surface: #0e1223;
  --surface-2: #131a2e;
  --border: #232c42;
  --border-soft: #1a2136;
  --text: #f1f5f9;
  --text-muted: #94a3b8;
  --text-faint: #64748b;
  --primary: #4f8cff;
  --primary-hover: #6ea0ff;
  --primary-soft: rgba(79,140,255,.14);
  --success: #22c55e;
  --success-soft: rgba(34,197,94,.14);
  --danger: #ef4444;
  --danger-soft: rgba(239,68,68,.14);
  --warning: #f0b93f;
  --warning-soft: rgba(240,185,63,.14);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-card: 0 1px 2px rgba(0,0,0,.35), 0 10px 26px -16px rgba(0,0,0,.6);
  --ease: 150ms ease;
}
* { box-sizing: border-box; }
body {
  font-family: Vazirmatn, Tahoma, "Segoe UI", sans-serif;
  margin: 0; background: var(--bg); color: var(--text);
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
}
a { color: var(--primary); transition: color var(--ease); }
a:hover { color: var(--primary-hover); }
::selection { background: var(--primary-soft); color: var(--text); }

a, button, .btn, input, select, textarea, [tabindex] {
  outline: none;
}
a:focus-visible, button:focus-visible, .btn:focus-visible,
input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

header.top {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 22px; background:var(--surface-2); border-bottom:1px solid var(--border);
  position: sticky; top: 0; z-index: 20;
}
header.top .brand { display:flex; align-items:center; gap:9px; font-weight:700; font-size:1.05rem; color:#fff; letter-spacing:-.01em; }
header.top .brand svg { flex-shrink:0; }

nav.tabs { display:flex; gap:2px; flex-wrap:wrap; padding:0 18px; background:var(--surface); border-bottom:1px solid var(--border); position: sticky; top: 53px; z-index: 19; }
nav.tabs a {
  padding:12px 14px; text-decoration:none; color:var(--text-muted); border-bottom:2px solid transparent;
  font-size:.9rem; font-weight:500; transition: color var(--ease), border-color var(--ease);
}
nav.tabs a:hover { color:var(--text); }
nav.tabs a.active { color:#fff; border-bottom-color:var(--primary); }

main { max-width:1080px; margin:0 auto; padding:26px 18px 64px; }

.card-box {
  background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg);
  padding:20px; margin-bottom:18px; box-shadow: var(--shadow-card); overflow-x:auto;
}
.card-box h3 { font-size:1rem; font-weight:600; letter-spacing:-.01em; }

.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; }
.stat {
  background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg);
  padding:16px 18px; box-shadow: var(--shadow-card); transition: border-color var(--ease);
}
.stat:hover { border-color: var(--border-soft); }
.stat .num { font-size:1.55rem; font-weight:700; color:#fff; letter-spacing:-.02em; font-variant-numeric: tabular-nums; }
.stat .lbl { color:var(--text-muted); font-size:.82rem; margin-top:5px; }

table { width:100%; border-collapse:collapse; font-size:.88rem; }
th, td { padding:11px 12px; border-bottom:1px solid var(--border-soft); text-align:right; white-space:nowrap; }
th { color:var(--text-muted); font-weight:600; font-size:.78rem; text-transform:uppercase; letter-spacing:.03em; }
tbody tr { transition: background-color var(--ease); }
tbody tr:hover { background:var(--surface-2); }
tbody tr:last-child td { border-bottom:none; }

input[type=text], input[type=password], input[type=number], input[type=url], textarea, select {
  width:100%; padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border);
  background:var(--bg); color:var(--text); font-family:inherit; font-size:.92rem; margin-top:4px;
  transition: border-color var(--ease), box-shadow var(--ease);
}
input:hover, select:hover, textarea:hover { border-color: var(--text-faint); }
input:focus, select:focus, textarea:focus {
  border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft);
}
label { display:block; font-size:.85rem; color:#c3c9d8; margin-bottom:12px; font-weight:500; }

button, .btn {
  background:var(--primary); color:#fff; border:none; padding:9px 18px; border-radius:var(--radius-sm);
  cursor:pointer; font-size:.87rem; font-weight:600; text-decoration:none; display:inline-block;
  transition: background-color var(--ease), transform var(--ease), opacity var(--ease);
}
button:hover, .btn:hover { background:var(--primary-hover); }
button:active, .btn:active { transform: scale(.97); }
button:disabled, .btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
button.secondary, .btn.secondary { background:var(--surface-2); color:var(--text); border:1px solid var(--border); }
button.secondary:hover, .btn.secondary:hover { background:var(--border-soft); }
button.danger, .btn.danger { background:var(--danger); }
button.danger:hover, .btn.danger:hover { background:#f65d5d; }
form.inline { display:inline; }

.badge {
  display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px;
  font-size:.74rem; font-weight:600;
}
.badge::before { content:""; width:6px; height:6px; border-radius:50%; background:currentColor; }
.badge.ok { background:var(--success-soft); color:var(--success); }
.badge.off { background:var(--danger-soft); color:#f28787; }
.badge.pending { background:var(--warning-soft); color:var(--warning); }

.flash {
  padding:12px 16px; border-radius:var(--radius-md); margin-bottom:18px; font-size:.9rem;
  border-inline-start: 3px solid transparent;
}
.flash.info { background:var(--success-soft); color:#8de0ab; border-color:var(--success); }
.flash.error { background:var(--danger-soft); color:#f0a3a3; border-color:var(--danger); }
.flash.token { background:var(--surface-2); color:#8fc7ff; font-family:monospace; word-break:break-all; border-color:var(--primary); }

.mono { font-family: "SFMono-Regular", Consolas, monospace; font-variant-numeric: tabular-nums; }
.muted { color:var(--text-muted); }

.checkbox-list { display:flex; flex-direction:column; gap:9px; }
.checkbox-list label { display:flex; align-items:center; gap:9px; font-size:.9rem; margin:0; font-weight:400; }
.checkbox-list input { width:auto; margin:0; accent-color:var(--primary); }

@media (max-width: 640px) {
  header.top { padding:12px 16px; }
  nav.tabs { padding:0 12px; top:49px; }
  nav.tabs a { padding:10px 11px; font-size:.85rem; }
  main { padding:18px 12px 48px; }
  .card-box { padding:15px; border-radius:var(--radius-md); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
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
${showNav ? `<header class="top"><div class="brand"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3" stroke="#4f8cff" stroke-width="1.8"/><path d="M2 9.5H22" stroke="#4f8cff" stroke-width="1.8"/><rect x="5" y="13.5" width="5" height="2" rx="1" fill="#4f8cff"/></svg>AryallehPay</div></header>` : ""}
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
