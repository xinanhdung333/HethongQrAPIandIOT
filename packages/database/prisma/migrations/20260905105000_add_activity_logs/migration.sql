CREATE TABLE "activity_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "method" TEXT,
  "path" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");
CREATE INDEX "activity_logs_action_created_at_idx" ON "activity_logs"("action", "created_at");

ALTER TABLE "activity_logs"
ADD CONSTRAINT "activity_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
