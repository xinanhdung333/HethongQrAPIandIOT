import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class ApiVerifyQrDto {
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  qr_jwt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8192)
  ticket_code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  gate_id!: string;
}
