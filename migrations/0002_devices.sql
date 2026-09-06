-- 0002_devices.sql
-- Adds SMS-forwarder device tracking (multiple phones, per-service device
-- scoping, online/offline status). Run this once against an already-deployed
-- database (schema.sql already includes this for fresh installs):
--
--   wrangler d1 execute aryalleh_pay --remote --file=migrations/0002_devices.sql
--
CREATE TABLE IF NOT EXISTS devices (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    token        TEXT NOT NULL UNIQUE,
    is_active    INTEGER DEFAULT 1,
    last_seen_at TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
);

ALTER TABLE services ADD COLUMN device_id INTEGER REFERENCES devices(id);
