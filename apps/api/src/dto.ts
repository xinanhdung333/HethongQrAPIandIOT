import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";

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
}

export class RentalDto {
  @IsString() product_id!: string;
  @IsIn(["rent", "buy"]) type!: "rent" | "buy";
  @IsInt() @Min(1) duration!: number;
  @IsInt() @Min(1) quantity!: number;
  @IsObject()
  shipping_address!: Record<string, unknown>;
  @IsBoolean() agree_damage_terms!: boolean;
}

export class ApiRentalDto {
  @IsString() @IsNotEmpty() app_name!: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() callback_url?: string;
  @IsIn(["starter", "business"]) plan!: "starter" | "business";
  @IsInt() @Min(1) duration!: number;
  @IsOptional() @IsArray() @IsIn(["qr:create", "qr:read", "ticket:verify"], { each: true }) scopes?: Array<"qr:create" | "qr:read" | "ticket:verify">;
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
}

export class PayosWebhookDto {
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
}

export class AdminUpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) price_sell?: number;
  @IsOptional() @IsInt() @Min(0) price_rent_month?: number;
  @IsOptional() @IsInt() @Min(0) deposit_fee?: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() images?: string[];
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
