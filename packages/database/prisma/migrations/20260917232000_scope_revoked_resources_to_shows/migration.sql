ALTER TABLE "revoked_resources" ADD COLUMN "show_id" TEXT;

ALTER TABLE "revoked_resources"
ADD CONSTRAINT "revoked_resources_show_id_fkey"
FOREIGN KEY ("show_id") REFERENCES "shows"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "revoked_resources_show_id_revoked_at_idx"
ON "revoked_resources"("show_id", "revoked_at");
