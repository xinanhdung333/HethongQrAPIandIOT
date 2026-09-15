-- Settings, payout accounts, payment transaction split, avatar and webhook manual replay controls.

CREATE TYPE "PayoutMethod" AS ENUM ('BANK', 'WALLET');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAYOUT_PROCESSING', 'PAYOUT_COMPLETED', 'FAILED', 'DISPUTED');

ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
ALTER TABLE "api_rental_orders" ADD COLUMN "commission_rate_override_bp" INTEGER;
ALTER TABLE "webhook_events" ADD COLUMN "manual_replay_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "payout_accounts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "method" "PayoutMethod" NOT NULL DEFAULT 'BANK',
  "bank_name" TEXT,
  "account_number" TEXT,
  "account_name" TEXT NOT NULL,
  "branch" TEXT,
  "wallet_type" TEXT,
  "wallet_id" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payout_accounts_user_id_is_default_idx" ON "payout_accounts"("user_id", "is_default");
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "system_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

CREATE TABLE "payment_transactions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "qr_code_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "gross_amount" INTEGER NOT NULL,
  "commission_rate_bp" INTEGER NOT NULL,
  "commission_amount" INTEGER NOT NULL,
  "user_amount" INTEGER NOT NULL,
  "payout_account_id" TEXT,
  "payout_account_snapshot" JSONB,
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "payout_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  "payout_completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_transactions_idempotency_key_key" ON "payment_transactions"("idempotency_key");
CREATE INDEX "payment_transactions_user_id_created_at_idx" ON "payment_transactions"("user_id", "created_at");
CREATE INDEX "payment_transactions_rental_id_created_at_idx" ON "payment_transactions"("rental_id", "created_at");
CREATE INDEX "payment_transactions_status_created_at_idx" ON "payment_transactions"("status", "created_at");
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "api_rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "external_qr_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payout_account_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "payout_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "system_settings" ("id", "key", "value", "version", "created_at", "updated_at")
VALUES (
  'sys_api_platform_default',
  'api_platform',
  '{"commission_rate_bp":1000,"quota_warning_thresholds":[80,95],"feature_flags":{"api_explorer":true,"bulk_create":true,"pay_as_you_go":true},"plan_limits":{"starter":{"max_keys":2,"quota":5000,"rate_limit":60,"price":199000},"business":{"max_keys":10,"quota":30000,"rate_limit":600,"price":499000}}}'::jsonb,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
