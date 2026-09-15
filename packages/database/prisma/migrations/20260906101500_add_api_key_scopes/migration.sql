-- Add permission scopes to rented/API keys.
-- Rollback: ALTER TABLE "api_keys" DROP COLUMN "scopes";

ALTER TABLE "api_keys"
ADD COLUMN "scopes" JSONB NOT NULL DEFAULT '["qr:create","qr:read","ticket:verify"]';

ALTER TABLE "api_rental_orders"
ADD COLUMN "scopes" JSONB NOT NULL DEFAULT '["qr:create","qr:read","ticket:verify"]';
