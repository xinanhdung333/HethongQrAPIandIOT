CREATE TABLE "api_rental_orders" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "app_name" TEXT NOT NULL,
  "website" TEXT,
  "plan" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "quota" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "status" "RentalStatus" NOT NULL DEFAULT 'PENDING',
  "payos_payment_id" TEXT,
  "api_key_prefix" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "api_rental_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_qr_codes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "api_key_id" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "qr_jwt" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "customer_ref" TEXT,
  "payload" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "is_used" BOOLEAN NOT NULL DEFAULT false,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "external_qr_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_qr_codes_jti_key" ON "external_qr_codes"("jti");
CREATE UNIQUE INDEX "external_qr_codes_code_key" ON "external_qr_codes"("code");
CREATE INDEX "external_qr_codes_user_id_created_at_idx" ON "external_qr_codes"("user_id", "created_at");
CREATE INDEX "external_qr_codes_api_key_id_created_at_idx" ON "external_qr_codes"("api_key_id", "created_at");

ALTER TABLE "api_rental_orders" ADD CONSTRAINT "api_rental_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_qr_codes" ADD CONSTRAINT "external_qr_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_qr_codes" ADD CONSTRAINT "external_qr_codes_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
