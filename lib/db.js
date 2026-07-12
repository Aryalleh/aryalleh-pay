// lib/db.js — D1 data access layer for AryallehPay
import { hashPassword, verifyPassword, randomToken, randomUrlSafeToken } from "./crypto.js";

// ── Services ─────────────────────────────────────────────────────────────────

export function generateServiceToken() {
    return randomToken("aryp_", 24);
}

export async function createService(env, name, description, callbackUrl) {
    const token = generateServiceToken();
    const res = await env.DB.prepare(
        "INSERT INTO services (name, description, token, callback_url) VALUES (?,?,?,?)"
    ).bind(name, description, token, callbackUrl).run();
    return { id: res.meta.last_row_id, token };
}

export async function getServices(env) {
    const { results } = await env.DB.prepare(
        "SELECT * FROM services ORDER BY created_at DESC"
    ).all();
    return results;
}

export async function getServiceById(env, id) {
    return await env.DB.prepare("SELECT * FROM services WHERE id=?").bind(id).first();
}

export async function getServiceByToken(env, token) {
    return await env.DB.prepare(
        "SELECT * FROM services WHERE token=? AND is_active=1"
    ).bind(token).first();
}

export async function toggleService(env, id, isActive) {
    await env.DB.prepare("UPDATE services SET is_active=? WHERE id=?").bind(isActive ? 1 : 0, id).run();
}

export async function deleteService(env, id) {
    await env.DB.prepare("DELETE FROM services WHERE id=?").bind(id).run();
}

export async function regenerateServiceToken(env, id) {
    const token = generateServiceToken();
    await env.DB.prepare("UPDATE services SET token=? WHERE id=?").bind(token, id).run();
    return token;
}

// ── Per-service card scoping ─────────────────────────────────────────────────
// No rows in service_cards for a service => unrestricted (all active cards).

export async function getServiceCardIds(env, serviceId) {
    const { results } = await env.DB.prepare(
        "SELECT card_id FROM service_cards WHERE service_id=?"
    ).bind(serviceId).all();
    return results.map((r) => r.card_id);
}

export async function setServiceCards(env, serviceId, cardIds) {
    await env.DB.batch([
        env.DB.prepare("DELETE FROM service_cards WHERE service_id=?").bind(serviceId),
        ...cardIds.map((cid) =>
            env.DB.prepare("INSERT INTO service_cards (service_id, card_id) VALUES (?,?)").bind(serviceId, cid)
        ),
    ]);
}

export async function getCardsForService(env, serviceId) {
    const restrictedIds = await getServiceCardIds(env, serviceId);
    if (restrictedIds.length === 0) {
        return await getCards(env, true);
    }
    const placeholders = restrictedIds.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
        `SELECT * FROM cards WHERE is_active=1 AND id IN (${placeholders}) ORDER BY id`
    ).bind(...restrictedIds).all();
    return results;
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function isAmountPending(env, amountRials) {
    const row = await env.DB.prepare(
        `SELECT id FROM pending_payments
         WHERE amount_rials=? AND status='pending'
           AND (expires_at IS NULL OR expires_at > datetime('now'))
         LIMIT 1`
    ).bind(amountRials).first();
    return !!row;
}

/**
 * Finds an amount close to `baseAmount` that isn't currently pending, by
 * nudging it up with small random Rial offsets until it's free. Once a
 * payment is matched/expired it stops being "pending" and its amount is
 * automatically reusable again — this only ever needs to dodge amounts that
 * are open *right now*.
 */
export async function findUniqueAmount(env, baseAmount, maxAttempts = 30) {
    let amount = baseAmount;
    for (let i = 0; i < maxAttempts; i++) {
        if (!(await isAmountPending(env, amount))) return amount;
        amount = baseAmount + Math.floor(Math.random() * 900) + 100 * (i + 1);
    }
    throw new Error("در حال حاضر امکان یافتن مبلغ یکتا نبود، کمی بعد دوباره تلاش کنید");
}

export async function createPendingPayment(env, serviceId, orderId, amountRials, description, expiresMinutes = 30, redirectUrl = "") {
    const expiresAt = new Date(Date.now() + expiresMinutes * 60000).toISOString().slice(0, 19).replace("T", " ");
    const payToken = randomUrlSafeToken(24);
    try {
        const res = await env.DB.prepare(
            `INSERT INTO pending_payments
             (service_id, order_id, amount_rials, description, redirect_url, pay_token, expires_at)
             VALUES (?,?,?,?,?,?,?)`
        ).bind(serviceId, orderId, amountRials, description, redirectUrl, payToken, expiresAt).run();
        return { id: res.meta.last_row_id, amount_rials: amountRials, expires_at: expiresAt, pay_token: payToken };
    } catch (e) {
        if (String(e.message || e).includes("UNIQUE")) {
            throw new Error(`order_id '${orderId}' already exists for this service`);
        }
        throw e;
    }
}

export async function getPendingPayments(env, serviceId = null, limit = 200) {
    if (serviceId) {
        const { results } = await env.DB.prepare(
            `SELECT p.*, s.name as service_name FROM pending_payments p
             JOIN services s ON s.id=p.service_id
             WHERE p.service_id=? ORDER BY p.created_at DESC`
        ).bind(serviceId).all();
        return results;
    }
    const { results } = await env.DB.prepare(
        `SELECT p.*, s.name as service_name FROM pending_payments p
         JOIN services s ON s.id=p.service_id
         ORDER BY p.created_at DESC LIMIT ?`
    ).bind(limit).all();
    return results;
}

export async function findMatchingPayment(env, amountRials) {
    return await env.DB.prepare(
        `SELECT p.*, s.callback_url, s.name as service_name
         FROM pending_payments p
         JOIN services s ON s.id=p.service_id
         WHERE p.amount_rials=?
           AND p.status='pending'
           AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
         ORDER BY p.created_at ASC
         LIMIT 1`
    ).bind(amountRials).first();
}

export async function markPaymentMatched(env, paymentId) {
    await env.DB.prepare("UPDATE pending_payments SET status='matched' WHERE id=?").bind(paymentId).run();
}

export async function getPaymentById(env, paymentId) {
    return await env.DB.prepare(
        `SELECT p.*, s.callback_url, s.name as service_name
         FROM pending_payments p
         JOIN services s ON s.id=p.service_id
         WHERE p.id=?`
    ).bind(paymentId).first();
}

export async function getPaymentByToken(env, payToken) {
    return await env.DB.prepare(
        `SELECT p.*, s.name as service_name, s.callback_url, s.id as service_id
         FROM pending_payments p
         JOIN services s ON s.id=p.service_id
         WHERE p.pay_token=?`
    ).bind(payToken).first();
}

export async function manualConfirmPayment(env, paymentId, note = "") {
    const payment = await getPaymentById(env, paymentId);
    if (!payment) throw new Error("پرداخت پیدا نشد");
    if (payment.status !== "pending") throw new Error(`وضعیت پرداخت '${payment.status}' است و قابل تأیید نیست`);

    const paidAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    await markPaymentMatched(env, paymentId);
    const smsId = await logSms(env, `[تأیید دستی] ${note}`, payment.amount_rials, paidAt, "manual", paymentId);
    const txId = await createTransaction(env, payment, smsId, paidAt);
    return { tx_id: txId, payment, paid_at: paidAt };
}

// ── SMS logs ─────────────────────────────────────────────────────────────────

export async function logSms(env, raw, amount, paidAt, parseStatus, matchedId) {
    const res = await env.DB.prepare(
        `INSERT INTO sms_logs (raw_message, amount_rials, paid_at, parse_status, matched_payment_id)
         VALUES (?,?,?,?,?)`
    ).bind(raw, amount, paidAt, parseStatus, matchedId).run();
    return res.meta.last_row_id;
}

// ── Transactions ─────────────────────────────────────────────────────────────

export async function createTransaction(env, payment, smsLogId, paidAt) {
    const res = await env.DB.prepare(
        `INSERT INTO transactions (payment_id, sms_log_id, service_id, order_id, amount_rials, paid_at)
         VALUES (?,?,?,?,?,?)`
    ).bind(payment.id, smsLogId, payment.service_id, payment.order_id, payment.amount_rials, paidAt).run();
    return res.meta.last_row_id;
}

export async function getTransactions(env, limit = 100) {
    const { results } = await env.DB.prepare(
        `SELECT t.*, s.name as service_name FROM transactions t
         JOIN services s ON s.id=t.service_id
         ORDER BY t.created_at DESC LIMIT ?`
    ).bind(limit).all();
    return results;
}

export async function updateCallbackStatus(env, txId, status, response) {
    await env.DB.prepare(
        "UPDATE transactions SET callback_status=?, callback_response=? WHERE id=?"
    ).bind(status, response, txId).run();
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(env) {
    const [totalTx, totalAmount, pendingCnt, svcCount] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as c FROM transactions").first(),
        env.DB.prepare("SELECT COALESCE(SUM(amount_rials),0) as s FROM transactions").first(),
        env.DB.prepare("SELECT COUNT(*) as c FROM pending_payments WHERE status='pending'").first(),
        env.DB.prepare("SELECT COUNT(*) as c FROM services WHERE is_active=1").first(),
    ]);
    return {
        total_transactions: totalTx.c,
        total_amount_rials: totalAmount.s,
        pending_payments: pendingCnt.c,
        active_services: svcCount.c,
    };
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(env, key) {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
    return row ? row.value : null;
}

export async function setSetting(env, key, value) {
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)").bind(key, value).run();
}

// ── Admin password (first-login setup) ────────────────────────────────────────

export async function isAdminPasswordSet(env) {
    return (await getSetting(env, "admin_password_hash")) !== null;
}

export async function verifyAdminPassword(env, password) {
    const stored = await getSetting(env, "admin_password_hash");
    if (!stored) return false;
    return await verifyPassword(password, stored);
}

export async function setAdminPassword(env, newPassword) {
    await setSetting(env, "admin_password_hash", await hashPassword(newPassword));
}

// ── Sessions ─────────────────────────────────────────────────────────────────

const SESSION_TTL_SECONDS = 7 * 24 * 3600;

export async function createSession(env) {
    const token = randomToken("sess_", 32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString().slice(0, 19).replace("T", " ");
    await env.DB.prepare("INSERT INTO admin_sessions (token, expires_at) VALUES (?,?)").bind(token, expiresAt).run();
    return { token, maxAge: SESSION_TTL_SECONDS };
}

export async function isSessionValid(env, token) {
    if (!token) return false;
    const row = await env.DB.prepare(
        "SELECT token FROM admin_sessions WHERE token=? AND expires_at > datetime('now')"
    ).bind(token).first();
    return !!row;
}

export async function deleteSession(env, token) {
    if (!token) return;
    await env.DB.prepare("DELETE FROM admin_sessions WHERE token=?").bind(token).run();
}

// ── SMS receiver secret key ───────────────────────────────────────────────────

export async function getSmsToken(env) {
    let token = await getSetting(env, "sms_receiver_token");
    if (!token) {
        token = randomToken("sms_", 20);
        await setSetting(env, "sms_receiver_token", token);
    }
    return token;
}

export async function regenerateSmsToken(env) {
    const token = randomToken("sms_", 20);
    await setSetting(env, "sms_receiver_token", token);
    return token;
}

export async function isSmsTokenRequired(env) {
    const v = await getSetting(env, "require_sms_token");
    return v === null ? true : v === "1"; // secure by default
}

export async function setSmsTokenRequired(env, required) {
    await setSetting(env, "require_sms_token", required ? "1" : "0");
}

// ── Telegram bot settings ─────────────────────────────────────────────────────

export async function getBotSettings(env) {
    const { results } = await env.DB.prepare(
        "SELECT key, value FROM settings WHERE key IN ('bot_token','admin_chat_id','bot_service_token','telegram_webhook_secret')"
    ).all();
    const out = {};
    for (const r of results) out[r.key] = r.value;
    return out;
}

export async function saveBotSettings(env, botToken, adminChatId, serviceToken, webhookSecret) {
    await env.DB.batch([
        env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('bot_token',?)").bind(botToken),
        env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('admin_chat_id',?)").bind(adminChatId),
        env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('bot_service_token',?)").bind(serviceToken),
        env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('telegram_webhook_secret',?)").bind(webhookSecret),
    ]);
}

// ── Cards ────────────────────────────────────────────────────────────────────

export async function getCards(env, activeOnly = true) {
    const q = activeOnly
        ? "SELECT * FROM cards WHERE is_active=1 ORDER BY id"
        : "SELECT * FROM cards ORDER BY id";
    const { results } = await env.DB.prepare(q).all();
    return results;
}

export async function createCard(env, label, cardNumber, sheba, ownerName) {
    const res = await env.DB.prepare(
        "INSERT INTO cards (label,card_number,sheba,owner_name) VALUES (?,?,?,?)"
    ).bind(label, cardNumber, sheba, ownerName).run();
    return res.meta.last_row_id;
}

export async function deleteCard(env, cardId) {
    await env.DB.prepare("DELETE FROM cards WHERE id=?").bind(cardId).run();
}

export async function toggleCard(env, cardId, isActive) {
    await env.DB.prepare("UPDATE cards SET is_active=? WHERE id=?").bind(isActive ? 1 : 0, cardId).run();
}

export async function getCardById(env, cardId) {
    return await env.DB.prepare("SELECT * FROM cards WHERE id=?").bind(cardId).first();
}
