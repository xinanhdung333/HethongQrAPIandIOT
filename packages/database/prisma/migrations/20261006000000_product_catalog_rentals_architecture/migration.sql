-- Product catalog v2. Existing Product columns remain for a backwards compatible rollout.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TYPE "CatalogProductType" AS ENUM ('linh_kien', 'thiet_bi_ban', 'thiet_bi_thue');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "RentalBookingStatus" AS ENUM ('cho_duyet', 'da_duyet', 'dang_thue', 'da_tra', 'qua_han');

CREATE TABLE "product_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

ALTER TABLE "products"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "category_id" UUID,
  ADD COLUMN "product_type" "CatalogProductType",
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "description" TEXT;
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "product_sale_details" (
  "product_id" TEXT NOT NULL,
  "gia_nhap" INTEGER NOT NULL,
  "gia_ban" INTEGER NOT NULL,
  "gia_khuyen_mai" INTEGER,
  "so_luong_ton" INTEGER NOT NULL DEFAULT 0,
  "bao_hanh_thang" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_sale_details_pkey" PRIMARY KEY ("product_id"),
  CONSTRAINT "product_sale_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "product_rental_details" (
  "product_id" TEXT NOT NULL,
  "gia_thue_ngay" INTEGER,
  "gia_thue_tuan" INTEGER,
  "gia_thue_thang" INTEGER,
  "tien_coc" INTEGER NOT NULL DEFAULT 0,
  "tong_so_luong" INTEGER NOT NULL DEFAULT 0,
  "so_luong_kha_dung" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_rental_details_pkey" PRIMARY KEY ("product_id"),
  CONSTRAINT "product_rental_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "rentals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "tu_ngay" TIMESTAMP(3) NOT NULL,
  "den_ngay" TIMESTAMP(3) NOT NULL,
  "tong_tien" INTEGER NOT NULL,
  "tien_coc" INTEGER NOT NULL,
  "status" "RentalBookingStatus" NOT NULL DEFAULT 'cho_duyet',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rentals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rentals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rentals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rentals_valid_period" CHECK ("den_ngay" > "tu_ngay")
);
CREATE INDEX "rentals_product_period_idx" ON "rentals"("product_id", "tu_ngay", "den_ngay");
CREATE INDEX "rentals_customer_created_idx" ON "rentals"("customer_id", "created_at");

-- A product cannot have overlapping bookings while it is awaiting approval,
-- approved, or being rented. The half-open range allows adjacent bookings.
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_no_overlapping_booking"
  EXCLUDE USING gist ("product_id" WITH =, tsrange("tu_ngay", "den_ngay", '[)') WITH &&)
  WHERE ("status" IN ('cho_duyet', 'da_duyet', 'dang_thue', 'qua_han'));
