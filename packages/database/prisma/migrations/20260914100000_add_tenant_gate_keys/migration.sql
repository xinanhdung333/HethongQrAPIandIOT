CREATE TABLE "tenant_gate_keys" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "private_key_enc" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RS256',
    "previous_public_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "tenant_gate_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_gate_keys_tenant_id_key" ON "tenant_gate_keys"("tenant_id");
