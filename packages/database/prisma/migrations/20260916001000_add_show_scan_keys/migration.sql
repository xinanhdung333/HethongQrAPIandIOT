ALTER TABLE "api_keys" ADD COLUMN "show_id" TEXT;

ALTER TABLE "api_keys"
ADD CONSTRAINT "api_keys_show_id_fkey"
FOREIGN KEY ("show_id") REFERENCES "shows"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "api_keys_show_id_idx" ON "api_keys"("show_id");
