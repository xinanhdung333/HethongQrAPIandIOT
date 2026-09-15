import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

/** v1 accepts arbitrary resource types: integrations do not need server plugins. */
export class ApiCreateQrDto {
  @IsString() @IsNotEmpty() @MaxLength(100) resource_type!: string;
  @IsString() @IsNotEmpty() @MaxLength(255) resource_id!: string;
  @IsOptional() @IsString() @MaxLength(255) customer_ref?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(60) ttl_seconds?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000000) max_uses?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(128, { each: true }) allowed_gate_ids?: string[];
  @IsOptional() @IsDateString() not_before?: string;
}

export class ApiBulkCreateQrDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ApiCreateQrDto)
  resources!: ApiCreateQrDto[];
}

export class ApiVerifyQrDto {
  @IsOptional() @IsString() @MaxLength(8192) qr_jwt?: string;
  @IsOptional() @IsString() @MaxLength(8192) ticket_code?: string;
  @IsString() @IsNotEmpty() @MaxLength(128) gate_id!: string;
}
