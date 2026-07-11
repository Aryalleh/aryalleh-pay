# AryallehPay

پلتفرم مرکزی پرداخت کارت‌به‌کارت بر اساس تحلیل SMS بانکی — نسخهٔ **Cloudflare Pages Functions + D1**.

این نسخه به‌طور کامل روی Cloudflare Pages اجرا می‌شود: بدون سرور دائمی، بدون فایل SQLite محلی، و بات تلگرام از طریق **Webhook** کار می‌کند (نه polling)، چون Pages Functions پردازه یا Thread پایدار پشتیبانی نمی‌کند.

## ویژگی‌های این نسخه

- **کارت‌های مجاز به ازای هر API Key**: هر سرویس (API Key) می‌تواند به زیرمجموعه‌ای مشخص از کارت‌ها محدود شود؛ از پنل → سرویس‌ها → «کارت‌های مجاز». اگر هیچ کارتی برای یک سرویس انتخاب نشود، آن سرویس بدون محدودیت از همهٔ کارت‌های فعال استفاده می‌کند.
- **تعیین رمز عبور در اولین ورود**: دیگر رمز پیش‌فرضی وجود ندارد؛ اولین بار که به پنل مراجعه می‌کنید، از شما خواسته می‌شود رمز عبور تعیین کنید.
- **کلید محرمانهٔ SMS قابل‌تنظیم**: از پنل → تنظیمات می‌توانید مشخص کنید که آیا `POST /api/sms/receive` به هدر `Authorization: Bearer <sms_token>` نیاز دارد یا نه (پیش‌فرض: نیاز دارد).
- اجرا روی Cloudflare Pages Functions با پایگاه‌دادهٔ D1 (سازگار با SQLite).

## راه‌اندازی

```bash
npm install

# ساخت پایگاه‌داده D1 (یک‌بار) — database_id خروجی را در wrangler.toml بگذارید
npm run db:create

# اجرای اسکیمای اولیه
npm run db:migrate:local     # برای توسعهٔ محلی
npm run db:migrate:remote    # برای دیتابیس واقعی روی Cloudflare

# اجرای محلی
npm run dev

# استقرار
npm run deploy
```

پنل وب: `/panel/` — اولین بار که باز می‌کنید، صفحهٔ تعیین رمز عبور نمایش داده می‌شود.

## معماری

| بخش | قبل (Flask) | این نسخه (Cloudflare) |
|-----|-------------|------------------------|
| بک‌اند | Flask + Python thread | Pages Functions (JS) |
| پایگاه‌داده | فایل SQLite محلی | Cloudflare D1 |
| بات تلگرام | polling در Thread جدا | Webhook (`/telegram/webhook`) |
| Session پنل | Flask session امضاشده | کوکی + جدول `admin_sessions` در D1 |

هیچ متغیر محیطی/Secret‌ای در Cloudflare لازم نیست — توکن بات، رمز عبور و کلید SMS همگی از پنل مدیریت تنظیم و در D1 ذخیره می‌شوند؛ فقط باید D1 را طبق دستورات بالا bind کنید.

## Flow

```
سرویس (CrabVPN و...)
  → POST /api/payment/create  (ایجاد سفارش + مبلغ)

بات تلگرام (SMS forwarder، از طریق Webhook)
  → POST /telegram/webhook  (تلگرام پیام را مستقیم به اینجا می‌فرستد)
  → سیستم parse + match می‌کنه
  → callback به سرویس می‌زنه

سرویس
  → GET /api/payment/status/<order_id>  (پولینگ وضعیت)
```

## API Reference

مستندات کامل API برای ارتباط بین درگاه و سایت فروشنده (ساخت پرداخت، لینک
فاکتور/چک‌اوت، پولینگ وضعیت، callback و تأیید دستی): **[docs/API.md](docs/API.md)**
