DROP TABLE IF EXISTS "api_incidents";
DROP TABLE IF EXISTS "api_status_samples";
DROP TABLE IF EXISTS "api_notifications";
DROP TABLE IF EXISTS "webhook_attempts";
DROP TABLE IF EXISTS "webhook_events";
DROP TABLE IF EXISTS "api_request_logs";
DROP TABLE IF EXISTS "api_idempotency";
DROP TABLE IF EXISTS "api_usage_events";
DROP TABLE IF EXISTS "api_usage_periods";

DROP INDEX IF EXISTS "external_qr_codes_expires_at_expiry_notified_at_idx";

ALTER TABLE "external_qr_codes"
  DROP COLUMN IF EXISTS "metadata",
  DROP COLUMN IF EXISTS "is_test",
  DROP COLUMN IF EXISTS "max_uses",
  DROP COLUMN IF EXISTS "use_count",
  DROP COLUMN IF EXISTS "allowed_gate_ids",
  DROP COLUMN IF EXISTS "not_before",
  DROP COLUMN IF EXISTS "revoked_at",
  DROP COLUMN IF EXISTS "expiry_notified_at";

ALTER TABLE "api_rental_orders"
  DROP COLUMN IF EXISTS "signing_enabled",
  DROP COLUMN IF EXISTS "signing_secret",
  DROP COLUMN IF EXISTS "webhook_secret",
  DROP COLUMN IF EXISTS "billing_mode",
  DROP COLUMN IF EXISTS "create_unit_price",
  DROP COLUMN IF EXISTS "verify_unit_price";

ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_rental_id_fkey";

ALTER TABLE "api_keys"
  DROP COLUMN IF EXISTS "rental_id",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "is_test",
  DROP COLUMN IF EXISTS "allowed_ips",
  DROP COLUMN IF EXISTS "rate_limit",
  DROP COLUMN IF EXISTS "revoke_at",
  DROP COLUMN IF EXISTS "rotation_warned_at";
