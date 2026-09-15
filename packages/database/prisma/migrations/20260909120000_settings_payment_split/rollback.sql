-- Roll back settings, payout accounts and payment transaction split.

DROP TABLE IF EXISTS "payment_transactions";
DROP TABLE IF EXISTS "system_settings";
DROP TABLE IF EXISTS "payout_accounts";

ALTER TABLE "webhook_events" DROP COLUMN IF EXISTS "manual_replay_count";
ALTER TABLE "api_rental_orders" DROP COLUMN IF EXISTS "commission_rate_override_bp";
ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_url";

DROP TYPE IF EXISTS "PaymentTransactionStatus";
DROP TYPE IF EXISTS "PayoutMethod";
