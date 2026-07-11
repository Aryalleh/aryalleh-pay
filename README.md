# AryallehPay

پلتفرم مرکزی پرداخت کارت‌به‌کارت بر اساس تحلیل SMS بانکی

## راه‌اندازی

```bash
pip install -r requirements.txt
python app.py
```

پنل وب: http://localhost:5050/panel/

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|-------|---------|-------|
| `ADMIN_PASSWORD` | `admin1234` | رمز ورود پنل |
| `SECRET_KEY` | تصادفی | کلید session فلسک |
| `SMS_RECEIVER_TOKEN` | `sms_secret_change_me` | توکن endpoint دریافت SMS |

## Flow

```
سرویس (CrabVPN و...) 
  → POST /api/payment/create  (ایجاد سفارش + مبلغ)
  
بات تلگرام (SMS forwarder)
  → POST /api/sms/receive  (ارسال متن پیامک بانکی)
  → سیستم parse + match می‌کنه
  → callback به سرویس می‌زنه
  
سرویس
  → GET /api/payment/status/<order_id>  (پولینگ وضعیت)
```

## API Reference

### ایجاد پرداخت
```
POST /api/payment/create
Authorization: Bearer <service_token>

{
  "order_id": "ORD-001",
  "amount_rials": 500000,
  "description": "اشتراک ماهانه",
  "expires_minutes": 60
}
```

### دریافت SMS (از بات تلگرام)
```
POST /api/sms/receive
Authorization: Bearer <SMS_RECEIVER_TOKEN>

{
  "message": "متن پیامک بانکی"
}
```
