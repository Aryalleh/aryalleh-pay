-- schema.sql — AryallehPay D1 schema (Cloudflare)
CREATE TABLE IF NOT EXISTS services (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT NOT NULL UNIQUE,
    description          TEXT,
    token                TEXT NOT NULL UNIQUE,
    callback_url         TEXT,
    is_active            INTEGER DEFAULT 1,
    -- 1 = gateway auto-bumps a conflicting amount_rials by a few Rials;
    -- 0 = the seller site is responsible for uniqueness, gateway returns
    -- 409 amount_conflict on collision instead of adjusting it.
    auto_adjust_amount   INTEGER DEFAULT 1,
    -- Default payment expiry in hours, used when a payment/create call
    -- doesn't pass its own expires_minutes.
    default_expire_hours INTEGER DEFAULT 1,
    created_at           TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_payments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id   INTEGER NOT NULL REFERENCES services(id),
    order_id     TEXT NOT NULL,
    amount_rials INTEGER NOT NULL,
    description  TEXT,
    redirect_url TEXT,
    pay_token    TEXT UNIQUE,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT DEFAULT (datetime('now')),
    expires_at   TEXT,
    UNIQUE(service_id, order_id)
);

CREATE TABLE IF NOT EXISTS sms_logs (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_message        TEXT NOT NULL,
    amount_rials       INTEGER,
    paid_at            TEXT,
    parse_status       TEXT DEFAULT 'ok',
    matched_payment_id INTEGER REFERENCES pending_payments(id),
    received_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id        INTEGER NOT NULL REFERENCES pending_payments(id),
    sms_log_id        INTEGER REFERENCES sms_logs(id),
    service_id        INTEGER NOT NULL REFERENCES services(id),
    order_id          TEXT NOT NULL,
    amount_rials      INTEGER NOT NULL,
    paid_at           TEXT,
    callback_status   TEXT DEFAULT 'pending',
    callback_response TEXT,
    created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cards (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT NOT NULL,
    card_number TEXT NOT NULL,
    sheba       TEXT NOT NULL,
    owner_name  TEXT NOT NULL,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
);

-- Per-API-key (service) card scoping: which cards a given service may show
-- on its checkout page. No rows for a service = no restriction (all active
-- cards are eligible), keeping existing services working unchanged.
CREATE TABLE IF NOT EXISTS service_cards (
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    card_id    INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    PRIMARY KEY (service_id, card_id)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    token      TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
