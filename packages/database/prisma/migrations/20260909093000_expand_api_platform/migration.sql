-- Expand SmartQR API rental platform for scopes, sandbox keys, quota/rate analytics,
-- webhook outbox, idempotency, QR metadata and operational status.
-- Rollback SQL is kept beside this file in rollback.sql because Prisma only executes migration.sql.

ALTER TABLE "api_keys"
  ADD COLUMN "rental_id" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowed_ips" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "rate_limit" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "revoke_at" TIMESTAMP(3),
  ADD COLUMN "rotation_warned_at" TIMESTAMP(3);

UPDATE "api_keys" AS ak
SET "rental_id" = aro."id"
FROM "api_rental_orders" AS aro
WHERE ak."user_id" = aro."user_id"
  AND ak."prefix" = aro."api_key_prefix"
  AND aro."api_key_prefix" IS NOT NULL
  AND ak."rental_id" IS NULL;

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "api_rental_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "api_rental_orders"
  ADD COLUMN "signing_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "signing_secret" TEXT,
  ADD COLUMN "webhook_secret" TEXT,
  ADD COLUMN "billing_mode" TEXT NOT NULL DEFAULT 'fixed',
  ADD COLUMN "create_unit_price" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "verify_unit_price" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "external_qr_codes"
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "max_uses" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "use_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "allowed_gate_ids" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "not_before" TIMESTAMP(3),
  ADD COLUMN "revoked_at" TIMESTAMP(3),
  ADD COLUMN "expiry_notified_at" TIMESTAMP(3);

UPDATE "external_qr_codes"
SET "use_count" = CASE WHEN "is_used" THEN 1 ELSE 0 END;

CREATE INDEX "external_qr_codes_expires_at_expiry_notified_at_idx" ON "external_qr_codes"("expires_at", "expiry_notified_at");

CREATE TABLE "api_usage_periods" (
  "id" TEXT NOT NULL,
  "scope_id" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "is_test" BOOLEAN NOT NULL DEFAULT false,
  "qr_created" INTEGER NOT NULL DEFAULT 0,
  "verify_success" INTEGER NOT NULL DEFAULT 0,
  "verify_failed" INTEGER NOT NULL DEFAULT 0,
  "billed_amount" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "api_usage_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_usage_periods_scope_id_month_is_test_key" ON "api_usage_periods"("scope_id", "month", "is_test");

CREATE TABLE "api_usage_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "api_key_id" TEXT NOT NULL,
  "rental_id" TEXT,
  "action" TEXT NOT NULL,
  "resource_type" TEXT,
  "is_test" BOOLEAN NOT NULL DEFAULT false,
  "units" INTEGER NOT NULL DEFAULT 1,
  "cost" INTEGER NOT NULL DEFAULT 0,
  "success" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_usage_events_user_id_is_test_created_at_idx" ON "api_usage_events"("user_id", "is_test", "created_at");
CREATE INDEX "api_usage_events_rental_id_created_at_idx" ON "api_usage_events"("rental_id", "created_at");

CREATE TABLE "api_idempotency" (
  "id" TEXT NOT NULL,
  "scope_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "api_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_idempotency_scope_id_operation_key_key" ON "api_idempotency"("scope_id", "operation", "key");
CREATE INDEX "api_idempotency_expires_at_idx" ON "api_idempotency"("expires_at");

CREATE TABLE "api_request_logs" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "user_id" TEXT,
  "api_key_id" TEXT,
  "rental_id" TEXT,
  "method" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "ip" TEXT,
  "is_test" BOOLEAN NOT NULL DEFAULT false,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_request_logs_user_id_is_test_created_at_idx" ON "api_request_logs"("user_id", "is_test", "created_at");
CREATE INDEX "api_request_logs_api_key_id_created_at_idx" ON "api_request_logs"("api_key_id", "created_at");

CREATE TABLE "webhook_events" (
  "id" TEXT NOT NULL,
  "rental_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "target_url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "dedupe_key" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_dedupe_key_key" ON "webhook_events"("dedupe_key");
CREATE INDEX "webhook_events_status_next_attempt_at_idx" ON "webhook_events"("status", "next_attempt_at");
CREATE INDEX "webhook_events_rental_id_created_at_idx" ON "webhook_events"("rental_id", "created_at");

CREATE TABLE "webhook_attempts" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "status_code" INTEGER,
  "error" TEXT,
  "duration_ms" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_attempts_event_id_created_at_idx" ON "webhook_attempts"("event_id", "created_at");
ALTER TABLE "webhook_attempts" ADD CONSTRAINT "webhook_attempts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "webhook_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "api_notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "rental_id" TEXT,
  "dedupe_key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMP(3),
  "last_error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_notifications_dedupe_key_key" ON "api_notifications"("dedupe_key");
CREATE INDEX "api_notifications_status_next_attempt_at_idx" ON "api_notifications"("status", "next_attempt_at");

CREATE TABLE "api_status_samples" (
  "id" TEXT NOT NULL,
  "healthy" BOOLEAN NOT NULL,
  "latency_ms" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_status_samples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_status_samples_created_at_idx" ON "api_status_samples"("created_at");

CREATE TABLE "api_incidents" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'investigating',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "api_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_incidents_started_at_idx" ON "api_incidents"("started_at");
