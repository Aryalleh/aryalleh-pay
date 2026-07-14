-- 0001_service_amount_and_expiry_settings.sql
-- Adds per-service control over automatic amount uniquification and the
-- default payment expiry. Run this once against an already-deployed
-- database (schema.sql already includes these columns for fresh installs):
--
--   wrangler d1 execute aryalleh_pay --remote --file=migrations/0001_service_amount_and_expiry_settings.sql
--
ALTER TABLE services ADD COLUMN auto_adjust_amount INTEGER DEFAULT 1;
ALTER TABLE services ADD COLUMN default_expire_hours INTEGER DEFAULT 1;
