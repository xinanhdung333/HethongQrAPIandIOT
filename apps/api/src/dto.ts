import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(100) provinceName?: string;
  @IsOptional() @IsString() @MaxLength(32) provinceCode?: string;
  @IsOptional() @IsString() @MaxLength(100) districtName?: string;
  @IsOptional() @IsString() @MaxLength(32) districtCode?: string;
  @IsOptional() @IsString() @MaxLength(100) wardName?: string;
  @IsOptional() @IsString() @MaxLength(32) wardCode?: string;
}

export class RentalDto {
  @IsString() product_id!: string;
  @IsIn(["rent", "buy"]) type!: "rent" | "buy";
  @IsInt() @Min(1) duration!: number;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() start_date?: string;
  @IsObject()
  shipping_address!: Record<string, unknown>;
  @IsBoolean() agree_damage_terms!: boolean;
  @IsOptional() @IsIn(["payos_demo", "momo"]) payment_method?: "payos_demo" | "momo";
}

export class ApiRentalDto {
  @IsString() @IsNotEmpty() app_name!: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() callback_url?: string;
  @IsIn(["starter", "business"]) plan!: "starter" | "business";
  @IsInt() @Min(1) duration!: number;
  @IsOptional() @IsArray() @IsIn(["qr:create", "qr:read", "ticket:verify"], { each: true }) scopes?: Array<"qr:create" | "qr:read" | "ticket:verify">;
  @IsOptional() @IsIn(["payos_demo", "momo"]) payment_method?: "payos_demo" | "momo";
}

export class UpdateApiKeyScopesDto {
  @IsArray() @IsIn(["qr:create", "qr:read", "ticket:verify"], { each: true }) scopes!: Array<"qr:create" | "qr:read" | "ticket:verify">;
}

export class ShowDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() banner?: string;
  @IsString() theme_color!: string;
  @IsString() location!: string;
  @IsString() start_at!: string;
  @IsOptional() @IsString() end_at?: string;
  @IsInt() @Min(1000) ticket_price!: number;
  @IsInt() @Min(1) total_tickets!: number;
  @IsOptional() @IsString() description?: string;
  @IsObject()
  payout_account!: Record<string, unknown>;
}

export class BuyTicketDto {
  @IsString() buyer_name!: string;
  @IsEmail() buyer_email!: string;
  @IsString() @IsNotEmpty() buyer_phone!: string;
  @IsOptional() @IsString() buyer_note?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsIn(["payos_demo", "momo"]) payment_method?: "payos_demo" | "momo";
}

export class PayosWebhookDto {
  @IsOptional() @IsIn(["initial", "remaining"]) payment_stage?: "initial" | "remaining";
  @IsString() order_id!: string;
  @IsString() @IsOptional() kind?: "rental" | "ticket" | "api";
}

export class VerifyTicketDto {
  @IsOptional() @IsString() qr_jwt?: string;
  @IsOptional() @IsString() ticket_code?: string;
  @IsString() gate_id!: string;
}

export class CreateExternalQrDto {
  @IsString() @IsNotEmpty() resource_type!: string;
  @IsString() @IsNotEmpty() resource_id!: string;
  @IsOptional() @IsString() customer_ref?: string;
  @IsOptional() payload?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(60) ttl_seconds?: number;
}

export class BuyProductDto {
  @IsInt() @Min(1) quantity!: number;
  @IsObject()
  shipping_address!: Record<string, unknown>;
  @IsOptional() @IsIn(["payos_demo", "momo"]) payment_method?: "payos_demo" | "momo";
}

export class AdminUpdateProductDto {
  @IsOptional() @IsString() @IsNotEmpty() slug?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category_id?: string | null;
  @IsOptional() @IsIn(["LINH_KIEN", "THIET_BI_BAN", "THIET_BI_THUE"]) product_type?: "LINH_KIEN" | "THIET_BI_BAN" | "THIET_BI_THUE";
  @IsOptional() @IsIn(["IOT_MINI", "IOT_PRO", "COMPONENT"]) type?: "IOT_MINI" | "IOT_PRO" | "COMPONENT";
  @IsOptional() @IsInt() @Min(0) price_sell?: number;
  @IsOptional() @IsInt() @Min(0) price_rent_month?: number;
  @IsOptional() @IsInt() @Min(0) deposit_fee?: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsObject() specs?: Record<string, unknown>;
}

export class AdminCreateProductDto {
  @IsString() @IsNotEmpty() slug!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() category_id?: string | null;
  @IsOptional() @IsIn(["LINH_KIEN", "THIET_BI_BAN", "THIET_BI_THUE"]) product_type?: "LINH_KIEN" | "THIET_BI_BAN" | "THIET_BI_THUE";
  @IsIn(["IOT_MINI", "IOT_PRO", "COMPONENT"]) type!: "IOT_MINI" | "IOT_PRO" | "COMPONENT";
  @IsInt() @Min(0) price_sell!: number;
  @IsInt() @Min(0) price_rent_month!: number;
  @IsOptional() @IsInt() @Min(0) deposit_fee?: number;
  @IsInt() @Min(0) stock!: number;
  @IsArray() @IsString({ each: true }) images!: string[];
  @IsOptional() @IsObject() specs?: Record<string, unknown>;
}

export class AdminUpdateShowDto {
  @IsString() status!: "DRAFT" | "ACTIVE" | "ENDED";
}

export class AdminCreateApiKeyDto {
  @IsString() user_id!: string;
  @IsString() rental_id!: string;
}

export class AdminUpdateStaticPageDto {
  @IsOptional() @IsString() nav_label?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() hero_image?: string;
  @IsOptional() cta_primary?: Record<string, unknown>;
  @IsOptional() cta_secondary?: Record<string, unknown> | null;
  @IsOptional() sections?: unknown[];
  @IsOptional() @IsInt() sort_order?: number;
  @IsOptional() @IsBoolean() published?: boolean;
}
