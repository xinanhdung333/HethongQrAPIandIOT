ALTER TABLE "api_incidents" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "api_incidents" DROP COLUMN IF EXISTS "created_at";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "metadata";
