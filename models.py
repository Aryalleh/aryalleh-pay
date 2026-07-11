"""models.py — AryallehPay SQLite models"""
import sqlite3
import secrets
import hashlib
from datetime import datetime

DB_PATH = "aryalleh_pay.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS services (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            description TEXT,
            token       TEXT NOT NULL UNIQUE,
            callback_url TEXT,          -- POST callback after match
            is_active   INTEGER DEFAULT 1,
            created_at  TEXT DEFAULT (datetime('now'))
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
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_message  TEXT NOT NULL,
            amount_rials INTEGER,
            paid_at      TEXT,
            parse_status TEXT DEFAULT 'ok',      -- ok | failed
            matched_payment_id INTEGER REFERENCES pending_payments(id),
            received_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            payment_id      INTEGER NOT NULL REFERENCES pending_payments(id),
            sms_log_id      INTEGER REFERENCES sms_logs(id),
            service_id      INTEGER NOT NULL REFERENCES services(id),
            order_id        TEXT NOT NULL,
            amount_rials    INTEGER NOT NULL,
            paid_at         TEXT,
            callback_status TEXT DEFAULT 'pending', -- pending | success | failed
            callback_response TEXT,
            created_at      TEXT DEFAULT (datetime('now'))
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

        CREATE TABLE IF NOT EXISTS admin_sessions (
            token       TEXT PRIMARY KEY,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """)
        _init_default_settings(db)


# ── Service helpers ────────────────────────────────────────────────────────────

def generate_token() -> str:
    return "aryp_" + secrets.token_hex(24)


def create_service(name: str, description: str, callback_url: str) -> dict:
    token = generate_token()
    with get_db() as db:
        cur = db.execute(
            "INSERT INTO services (name, description, token, callback_url) VALUES (?,?,?,?)",
            (name, description, token, callback_url)
        )
        return {"id": cur.lastrowid, "token": token}


def get_services() -> list:
    with get_db() as db:
        return [dict(r) for r in db.execute(
            "SELECT * FROM services ORDER BY created_at DESC"
        ).fetchall()]


def get_service_by_token(token: str) -> dict | None:
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM services WHERE token=? AND is_active=1", (token,)
        ).fetchone()
        return dict(row) if row else None


def toggle_service(service_id: int, is_active: bool):
    with get_db() as db:
        db.execute("UPDATE services SET is_active=? WHERE id=?", (int(is_active), service_id))


def delete_service(service_id: int):
    with get_db() as db:
        db.execute("DELETE FROM services WHERE id=?", (service_id,))


def regenerate_token(service_id: int) -> str:
    token = generate_token()
    with get_db() as db:
        db.execute("UPDATE services SET token=? WHERE id=?", (token, service_id))
    return token


# ── Payment helpers ────────────────────────────────────────────────────────────

def create_pending_payment(service_id: int, order_id: str,
                           amount_rials: int, description: str,
                           expires_minutes: int = 30,
                           redirect_url: str = "") -> dict:
    from datetime import timedelta
    expires_at = (datetime.now() + timedelta(minutes=expires_minutes)).strftime("%Y-%m-%d %H:%M:%S")
    pay_token  = secrets.token_urlsafe(24)
    with get_db() as db:
        try:
            cur = db.execute(
                """INSERT INTO pending_payments
                   (service_id, order_id, amount_rials, description, redirect_url, pay_token, expires_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (service_id, order_id, amount_rials, description, redirect_url, pay_token, expires_at)
            )
            return {"id": cur.lastrowid, "expires_at": expires_at, "pay_token": pay_token}
        except sqlite3.IntegrityError:
            raise ValueError(f"order_id '{order_id}' already exists for this service")


def get_pending_payments(service_id: int = None) -> list:
    with get_db() as db:
        if service_id:
            rows = db.execute(
                """SELECT p.*, s.name as service_name FROM pending_payments p
                   JOIN services s ON s.id=p.service_id
                   WHERE p.service_id=? ORDER BY p.created_at DESC""",
                (service_id,)
            ).fetchall()
        else:
            rows = db.execute(
                """SELECT p.*, s.name as service_name FROM pending_payments p
                   JOIN services s ON s.id=p.service_id
                   ORDER BY p.created_at DESC LIMIT 200"""
            ).fetchall()
        return [dict(r) for r in rows]


def find_matching_payment(amount_rials: int) -> dict | None:
    """Find oldest pending payment matching this amount (not expired)."""
    with get_db() as db:
        row = db.execute(
            """SELECT p.*, s.callback_url, s.name as service_name
               FROM pending_payments p
               JOIN services s ON s.id=p.service_id
               WHERE p.amount_rials=?
                 AND p.status='pending'
                 AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
               ORDER BY p.created_at ASC
               LIMIT 1""",
            (amount_rials,)
        ).fetchone()
        return dict(row) if row else None


def mark_payment_matched(payment_id: int):
    with get_db() as db:
        db.execute(
            "UPDATE pending_payments SET status='matched' WHERE id=?", (payment_id,)
        )


def get_payment_by_id(payment_id: int) -> dict | None:
    with get_db() as db:
        row = db.execute(
            """SELECT p.*, s.callback_url, s.name as service_name
               FROM pending_payments p
               JOIN services s ON s.id=p.service_id
               WHERE p.id=?""",
            (payment_id,)
        ).fetchone()
        return dict(row) if row else None


def manual_confirm_payment(payment_id: int, note: str = "") -> dict:
    """
    Manually confirm a pending payment from the admin panel.
    Returns the created transaction dict, or raises ValueError if not possible.
    """
    payment = get_payment_by_id(payment_id)
    if not payment:
        raise ValueError("پرداخت پیدا نشد")
    if payment["status"] != "pending":
        raise ValueError(f"وضعیت پرداخت '{payment['status']}' است و قابل تأیید نیست")

    paid_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    mark_payment_matched(payment_id)
    sms_id = log_sms(
        raw=f"[تأیید دستی] {note}",
        amount=payment["amount_rials"],
        paid_at=paid_at,
        parse_status="manual",
        matched_id=payment_id
    )
    tx_id = create_transaction(payment, sms_id, paid_at)
    return {"tx_id": tx_id, "payment": payment, "paid_at": paid_at}


# ── SMS log helpers ────────────────────────────────────────────────────────────

def log_sms(raw: str, amount: int | None, paid_at: str | None,
            parse_status: str, matched_id: int | None) -> int:
    with get_db() as db:
        cur = db.execute(
            """INSERT INTO sms_logs (raw_message, amount_rials, paid_at, parse_status, matched_payment_id)
               VALUES (?,?,?,?,?)""",
            (raw, amount, paid_at, parse_status, matched_id)
        )
        return cur.lastrowid


# ── Transaction helpers ────────────────────────────────────────────────────────

def create_transaction(payment: dict, sms_log_id: int, paid_at: str) -> int:
    with get_db() as db:
        cur = db.execute(
            """INSERT INTO transactions
               (payment_id, sms_log_id, service_id, order_id, amount_rials, paid_at)
               VALUES (?,?,?,?,?,?)""",
            (payment["id"], sms_log_id, payment["service_id"],
             payment["order_id"], payment["amount_rials"], paid_at)
        )
        return cur.lastrowid


def get_transactions(limit: int = 100) -> list:
    with get_db() as db:
        rows = db.execute(
            """SELECT t.*, s.name as service_name FROM transactions t
               JOIN services s ON s.id=t.service_id
               ORDER BY t.created_at DESC LIMIT ?""",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def update_callback_status(tx_id: int, status: str, response: str):
    with get_db() as db:
        db.execute(
            "UPDATE transactions SET callback_status=?, callback_response=? WHERE id=?",
            (status, response, tx_id)
        )


# ── Stats ──────────────────────────────────────────────────────────────────────

def get_stats() -> dict:
    with get_db() as db:
        total_tx     = db.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        total_amount = db.execute("SELECT COALESCE(SUM(amount_rials),0) FROM transactions").fetchone()[0]
        pending_cnt  = db.execute("SELECT COUNT(*) FROM pending_payments WHERE status='pending'").fetchone()[0]
        svc_count    = db.execute("SELECT COUNT(*) FROM services WHERE is_active=1").fetchone()[0]
        return {
            "total_transactions": total_tx,
            "total_amount_rials": total_amount,
            "pending_payments": pending_cnt,
            "active_services": svc_count,
        }


# ── Settings helpers ───────────────────────────────────────────────────────────

def _ensure_settings_table():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        _init_default_settings(db)


def _init_default_settings(db):
    defaults = {
        "admin_password_hash": _hash_password("admin1234"),
        "sms_receiver_token":  "sms_" + secrets.token_hex(20),
    }
    for k, v in defaults.items():
        db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)", (k, v))


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_setting(key: str) -> str | None:
    with get_db() as db:
        row = db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row[0] if row else None


def set_setting(key: str, value: str):
    with get_db() as db:
        db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (key, value))


def verify_admin_password(password: str) -> bool:
    stored = get_setting("admin_password_hash")
    if not stored:
        return False
    return stored == _hash_password(password)


def change_admin_password(new_password: str):
    set_setting("admin_password_hash", _hash_password(new_password))


def get_sms_token() -> str:
    token = get_setting("sms_receiver_token")
    if not token:
        token = "sms_" + secrets.token_hex(20)
        set_setting("sms_receiver_token", token)
    return token


def regenerate_sms_token() -> str:
    token = "sms_" + secrets.token_hex(20)
    set_setting("sms_receiver_token", token)
    return token


def get_bot_settings() -> dict:
    with get_db() as db:
        rows = db.execute(
            "SELECT key, value FROM settings WHERE key IN ('bot_token','admin_chat_id','bot_service_token')"
        ).fetchall()
        return {r["key"]: r["value"] for r in rows}


def save_bot_settings(bot_token: str, admin_chat_id: str, service_token: str):
    with get_db() as db:
        for k, v in [
            ("bot_token",         bot_token),
            ("admin_chat_id",     admin_chat_id),
            ("bot_service_token", service_token),
        ]:
            db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", (k, v))


# ── Cards ──────────────────────────────────────────────────────────────────────

def _ensure_cards_table():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS cards (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                label      TEXT NOT NULL,
                card_number TEXT NOT NULL,
                sheba      TEXT NOT NULL,
                owner_name TEXT NOT NULL,
                is_active  INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

def get_cards(active_only=True) -> list:
    with get_db() as db:
        q = "SELECT * FROM cards"
        if active_only:
            q += " WHERE is_active=1"
        q += " ORDER BY id"
        return [dict(r) for r in db.execute(q).fetchall()]

def create_card(label, card_number, sheba, owner_name) -> int:
    with get_db() as db:
        cur = db.execute(
            "INSERT INTO cards (label,card_number,sheba,owner_name) VALUES (?,?,?,?)",
            (label, card_number, sheba, owner_name)
        )
        return cur.lastrowid

def delete_card(card_id: int):
    with get_db() as db:
        db.execute("DELETE FROM cards WHERE id=?", (card_id,))

def toggle_card(card_id: int, is_active: bool):
    with get_db() as db:
        db.execute("UPDATE cards SET is_active=? WHERE id=?", (int(is_active), card_id))


def get_payment_by_token(pay_token: str) -> dict | None:
    with get_db() as db:
        row = db.execute(
            """SELECT p.*, s.name as service_name, s.callback_url
               FROM pending_payments p
               JOIN services s ON s.id=p.service_id
               WHERE p.pay_token=?""",
            (pay_token,)
        ).fetchone()
        return dict(row) if row else None


def is_amount_pending(amount_rials: int) -> bool:
    """چک کن آیا این مبلغ الان توی یه سفارش pending هست"""
    with get_db() as db:
        row = db.execute(
            """SELECT id FROM pending_payments
               WHERE amount_rials=? AND status='pending'
               AND (expires_at IS NULL OR expires_at > datetime('now'))
               LIMIT 1""",
            (amount_rials,)
        ).fetchone()
        return row is not None
