ALTER TABLE "api_rental_orders" ADD COLUMN "callback_url" TEXT;

CREATE TABLE "external_qr_scan_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "external_qr_id" TEXT NOT NULL,
  "gate_id" TEXT NOT NULL,
  "valid" BOOLEAN NOT NULL,
  "reason" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "external_qr_scan_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "external_qr_scan_logs_user_id_created_at_idx" ON "external_qr_scan_logs"("user_id", "created_at");
CREATE INDEX "external_qr_scan_logs_external_qr_id_created_at_idx" ON "external_qr_scan_logs"("external_qr_id", "created_at");

ALTER TABLE "external_qr_scan_logs" ADD CONSTRAINT "external_qr_scan_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_qr_scan_logs" ADD CONSTRAINT "external_qr_scan_logs_external_qr_id_fkey" FOREIGN KEY ("external_qr_id") REFERENCES "external_qr_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
