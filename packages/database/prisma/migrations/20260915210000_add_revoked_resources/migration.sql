CREATE TABLE "revoked_resources" (
    "id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT,

    CONSTRAINT "revoked_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revoked_resources_resource_type_jti_key"
  ON "revoked_resources"("resource_type", "jti");
CREATE INDEX "revoked_resources_tenant_id_revoked_at_idx"
  ON "revoked_resources"("tenant_id", "revoked_at");
ALTER TABLE "revoked_resources"
  ADD CONSTRAINT "revoked_resources_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "revoked_resources" ("id", "resource_type", "jti", "revoked_at", "tenant_id", "user_id", "is_test")
SELECT 'legacy_' || "jti", 'external_qr', "jti", "revoked_at",
       COALESCE("api_keys"."rental_id", "external_qr_codes"."user_id"),
       "external_qr_codes"."user_id", "external_qr_codes"."is_test"
FROM "external_qr_codes"
JOIN "api_keys" ON "api_keys"."id" = "external_qr_codes"."api_key_id"
WHERE "external_qr_codes"."revoked_at" IS NOT NULL;

ALTER TABLE "api_keys" ADD COLUMN "suspend_until" TIMESTAMP(3);
