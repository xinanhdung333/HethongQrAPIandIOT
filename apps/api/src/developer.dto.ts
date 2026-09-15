import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min } from "class-validator";

const scopes = ["qr:create", "qr:read", "ticket:verify"] as const;

export class DeveloperUpdateKeyDto {
  @IsOptional() @IsArray() @IsIn(scopes, { each: true }) scopes?: Array<typeof scopes[number]>;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) allowed_ips?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(10000) rate_limit?: number;
}

export class DeveloperCreateKeyDto {
  @IsArray() @IsIn(scopes, { each: true }) scopes!: Array<typeof scopes[number]>;
}

export class DeveloperRotateKeyDto {
  @IsString() password!: string;
}

export class DeveloperRentalSettingsDto {
  @IsOptional() @IsBoolean() signing_enabled?: boolean;
  @IsOptional() @IsString() callback_url?: string;
}

export class DeveloperSecretDto {
  @IsIn(["signing", "webhook"]) kind!: "signing" | "webhook";
  @IsString() password!: string;
}

export class DeveloperPlanDto {
  @IsIn(["starter", "business"]) plan!: "starter" | "business";
  @IsIn(["fixed", "payg"]) billing_mode!: "fixed" | "payg";
}

export class DeveloperAuditQueryDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() endpoint?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() is_test?: string;
}

export class DeveloperAnalyticsQueryDto {
  @IsOptional() @IsString() month?: string;
  @IsOptional() @IsString() key_id?: string;
  @IsOptional() @IsString() is_test?: string;
}


