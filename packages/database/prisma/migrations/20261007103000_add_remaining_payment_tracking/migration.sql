CREATE TYPE "RemainingPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID');

ALTER TABLE "rental_orders"
  ADD COLUMN "remaining_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "remaining_paid_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "remaining_payment_status" "RemainingPaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "remaining_paid_at" TIMESTAMP(3);

UPDATE "rental_orders"
SET "remaining_amount" = GREATEST("total" - "deposit_amount", 0),
    "remaining_payment_status" = CASE WHEN GREATEST("total" - "deposit_amount", 0) = 0 THEN 'NOT_REQUIRED'::"RemainingPaymentStatus" ELSE 'PENDING'::"RemainingPaymentStatus" END;
