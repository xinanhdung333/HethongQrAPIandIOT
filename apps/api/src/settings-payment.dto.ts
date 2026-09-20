import { ArrayMaxSize, IsArray, IsBase64, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class PasswordDto {
  @IsString() @MaxLength(200) password!: string;
}

export class AvatarUploadDto {
  @IsString() avatar_data_url!: string;
}

export class PayoutAccountDto {
  @IsIn(["BANK", "WALLET"]) method!: "BANK" | "WALLET";
  @IsOptional() @IsString() @MaxLength(120) bank_name?: string;
  @IsOptional() @IsString() @MaxLength(64) account_number?: string;
  @IsString() @MaxLength(120) account_name!: string;
  @IsOptional() @IsString() @MaxLength(120) branch?: string;
  @IsOptional() @IsString() @MaxLength(80) wallet_type?: string;
  @IsOptional() @IsString() @MaxLength(120) wallet_id?: string;
  @IsOptional() is_default?: boolean;
}

export class PaymentCreateDto {
  @IsOptional() @IsString() qr_code_id?: string;
  @IsOptional() @IsString() rental_id?: string;
  @IsInt() @Min(1000) @Max(2_000_000_000) gross_amount!: number;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class PaymentQueryDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() rental_id?: string;
  @IsOptional() @IsString() page?: string;
}

export class PaymentStatusDto {
  @IsIn(["PENDING", "CONFIRMED", "PAYOUT_PROCESSING", "PAYOUT_COMPLETED", "FAILED", "DISPUTED"]) status!: "PENDING" | "CONFIRMED" | "PAYOUT_PROCESSING" | "PAYOUT_COMPLETED" | "FAILED" | "DISPUTED";
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class AdminApiPlatformSettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(5000) commission_rate_bp?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) quota_warning_thresholds?: number[];
  @IsOptional() @IsObject() quota_burst?: { window_minutes?: number; threshold_percent?: number; enabled?: boolean };
  @IsOptional() @IsObject() feature_flags?: Record<string, boolean>;
  @IsOptional() @IsObject() plan_limits?: Record<string, { max_keys?: number; quota?: number; rate_limit?: number; price?: number }>;
}


export class AdminIncidentDto {
  @IsString() @MaxLength(200) title!: string;
  @IsIn(["investigating", "identified", "monitoring", "resolved"]) status!: "investigating" | "identified" | "monitoring" | "resolved";
  @IsOptional() @IsString() started_at?: string;
  @IsOptional() @IsString() resolved_at?: string;
}
