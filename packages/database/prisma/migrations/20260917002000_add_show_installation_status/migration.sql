ALTER TABLE "shows"
ADD COLUMN "installation_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "scanner_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "installation_note" TEXT;
