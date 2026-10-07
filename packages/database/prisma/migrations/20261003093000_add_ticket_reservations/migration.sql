ALTER TABLE "shows" ADD COLUMN "reserved_tickets" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ticket_orders" ADD COLUMN "reservation_expires_at" TIMESTAMP(3);

ALTER TYPE "TicketOrderStatus" ADD VALUE 'EXPIRED';
