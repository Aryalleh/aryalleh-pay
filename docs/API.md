# AryallehPay — Seller Integration API

This is the contract between your site/service ("seller") and the AryallehPay
gateway. Get a **service token** first: panel → Services → create a service,
copy the token shown once (you can regenerate it later from the same page,
which invalidates the old one immediately).

## Base URL

Your deployed Cloudflare Pages domain, e.g.:

```
https://aryalleh-pay.pages.dev
```

(or your custom domain). All paths below are relative to this.

## Authentication

Every seller-facing endpoint (everything except `POST /api/sms/receive` and
`GET /api/pay/poll/:pay_token`) requires:

```
Authorization: Bearer <your_service_token>
```

Missing/invalid token → `401 { "ok": false, "error": "Unauthorized" }`.

---

## 1. Create a payment (invoice)

```
POST /api/payment/create
Authorization: Bearer <service_token>
Content-Type: application/json
```

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `order_id` | string | yes | Your own order/invoice ID. Must be unique **per service** — reusing one that already has a pending/matched payment fails. |
| `amount_rials` | integer | yes | Exact amount in Rials. Must be unique among currently-pending payments **across the whole gateway** (see below). |
| `description` | string | no | Shown to the customer on the checkout page. |
| `expires_minutes` | integer | no | Default `60`. After this, the invoice link shows "expired" and stops matching incoming SMS. |
| `redirect_url` | string | no | Where the customer is sent after the checkout page detects payment. If omitted, the checkout page just shows a success state in place. |

**Why amount must be unique while pending, and how that's handled**: matching
is done by reading the deposit amount off the bank SMS — there's no other
reference number to key off. Two open invoices (yours or anyone else's on the
gateway) can't share the exact same pending amount at the same time, or a
payment couldn't be matched unambiguously.

You don't need to handle this yourself: if the `amount_rials` you send is
already pending elsewhere, the gateway **automatically nudges it up** by a
small random number of Rials until it's unique, and returns the actual amount
in `amount_rials` on the response — **display that amount to the customer,
not the one you sent**, since that's the exact figure the gateway will match
against the incoming SMS. Once a payment is matched (paid) or expires, its
amount stops being "pending" and is automatically free for reuse by any
future invoice — nothing to clean up on your end.

**Example**

```bash
curl -X POST https://aryalleh-pay.pages.dev/api/payment/create \
  -H "Authorization: Bearer aryp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORD-1042",
    "amount_rials": 500000,
    "description": "اشتراک یک ماهه",
    "expires_minutes": 30,
    "redirect_url": "https://myshop.example.com/thanks?order=ORD-1042"
  }'
```

**Success — `200`**
```json
{
  "ok": true,
  "id": 17,
  "amount_rials": 500386,
  "requested_amount_rials": 500000,
  "amount_adjusted": true,
  "expires_at": "2026-07-11 21:10:00",
  "pay_token": "aBcD3f-9xyz...",
  "pay_url": "/pay/aBcD3f-9xyz..."
}
```

`amount_rials` is the amount actually stored and matched against — show this
one to the customer. `requested_amount_rials` is what you sent, and
`amount_adjusted` tells you at a glance whether the gateway had to bump it.
When there's no collision, `amount_rials` simply equals what you requested
and `amount_adjusted` is `false`.

`pay_url` is a **relative path** — prefix it with your gateway's base URL to
get the full invoice link customers should be redirected to:
`https://aryalleh-pay.pages.dev/pay/aBcD3f-9xyz...` (its checkout page already
shows the adjusted amount, so linking to it instead of rendering your own
amount is the safest option).

**Errors**
| Status | Body | Meaning |
|---|---|---|
| 400 | `{"ok":false,"error":"order_id and amount_rials are required"}` | Missing required field |
| 401 | `{"ok":false,"error":"Unauthorized"}` | Bad/missing token |
| 409 | `{"ok":false,"error":"در حال حاضر امکان یافتن مبلغ یکتا نبود..."}` | Extremely unlikely — the gateway couldn't find a free amount nearby after many attempts; retry shortly |
| 409 | `{"ok":false,"error":"order_id 'ORD-1042' already exists for this service"}` | Duplicate `order_id` for this service |

---

## 2. The invoice/checkout link

`GET /pay/<pay_token>` — **no auth**, this is what you redirect the customer
to (or embed as a link/QR code). It renders one of three states, and **the
link stays valid and viewable in all of them** — it never just disappears:

| Payment state | What the customer sees |
|---|---|
| `pending`, not expired | Amount + the specific bank cards to deposit to, auto-polling every 5s |
| `pending`, past `expires_at` | "⏳ Payment window expired" page |
| `matched` (paid) | "✅ Payment confirmed" page — **still shows correctly if the customer (or you) opens the link again later**, e.g. days after payment, for their own records |

So you can safely keep/share the `pay_url` as a permanent receipt link — it
doesn't need to be visited only once, and doesn't break after the money
arrives.

The cards shown are whichever ones your service is scoped to (panel →
Services → "کارت‌های مجاز"); if you haven't restricted your service to
specific cards, all active cards are shown.

---

## 3. Poll payment status (server-to-server)

```
GET /api/payment/status/<order_id>
Authorization: Bearer <service_token>
```

Use this from your backend to check whether an order has been paid — the
recommended way to confirm payment if you don't want to rely solely on the
callback (see §5, callbacks aren't retried on failure).

**Response — `200`**
```json
{
  "ok": true,
  "status": "pending",
  "amount_rials": 500000,
  "created_at": "2026-07-11 20:40:00",
  "expires_at": "2026-07-11 21:10:00"
}
```

`status` is one of: `pending`, `matched`. (`expired`/`cancelled` values exist
in the schema for future use but aren't currently set automatically — an
expired invoice simply stays `pending` past its `expires_at` and the checkout
page treats it as expired client-side; treat `pending` + `expires_at` in the
past as expired on your side too.)

`404` if `order_id` doesn't exist for your service.

---

## 4. List your payments

```
GET /api/payments/list
Authorization: Bearer <service_token>
```

Returns your last 200 payments (all statuses), most recent first — useful
for a reconciliation job.

```json
{ "ok": true, "payments": [ { "id": 17, "order_id": "ORD-1042", "amount_rials": 500000, "status": "matched", "pay_token": "...", "created_at": "...", "expires_at": "...", "redirect_url": "...", "description": "..." } ] }
```

---

## 5. Payment confirmation callback (webhook to you)

If you set a **Callback URL** on your service (panel → Services → create/edit),
the gateway calls it the moment a bank SMS matches one of your pending
payments:

```
POST <your callback_url>
Content-Type: application/json

{
  "event": "payment.confirmed",
  "order_id": "ORD-1042",
  "amount_rials": 500000,
  "paid_at": "2026-07-11 20:52:11",
  "tx_id": 88
}
```

Respond `2xx` — the response body isn't parsed, only logged for your own
troubleshooting (visible in panel → Transactions).

**Important — no automatic retry.** This is a single fire-and-forget HTTP
call; if your endpoint is down or times out, the gateway does **not** retry
it. Don't treat the callback as your only source of truth — poll
`GET /api/payment/status/<order_id>` as a fallback (e.g. before showing the
customer a "payment failed" state), or reconcile periodically against
`GET /api/payments/list`.

---

## 6. Manual confirm (admin override)

```
POST /api/payment/manual-confirm
Authorization: Bearer <service_token>
Content-Type: application/json

{ "payment_id": 17, "note": "confirmed by support" }
```

Marks a still-`pending` payment as paid without a matching SMS (e.g. you
verified the deposit manually) and fires the callback exactly like a normal
match. Same thing the admin panel's "تأیید دستی" button and the Telegram
bot's confirm button do.

```json
{ "ok": true, "tx_id": 89, "order_id": "ORD-1042", "paid_at": "2026-07-11 21:00:00" }
```

`409` if the payment isn't in `pending` state anymore.

---

## End-to-end flow

```
1. Seller: POST /api/payment/create           → get pay_url + order tracking
2. Seller: redirect customer to pay_url        → they see cards, deposit money
3. Customer's bank SMS reaches the gateway      (via the Telegram bot webhook
                                                  or a directly-integrated
                                                  SMS-forwarding app)
4. Gateway matches amount → fires callback to seller, checkout page flips
   to "confirmed" automatically (polls /api/pay/poll every 5s)
5. Seller: (recommended) also poll
   GET /api/payment/status/<order_id> before trusting the callback alone
```

## Notes

- All amounts are integer Rials, no decimals.
- Timestamps are `YYYY-MM-DD HH:MM:SS`, server (UTC) time, no timezone suffix.
- CORS is open (`Access-Control-Allow-Origin: *`) on the JSON API so you can
  call `/api/payment/create` directly from browser-side code too, though
  doing it server-side keeps your service token off the client.
- Rotating your service token (panel → Services → "توکن جدید") invalidates
  the old one immediately — update your backend config before rotating in
  production.
