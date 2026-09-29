import { Request } from "express";
import { ApiVerifyQrDto } from "../api-qr.dto";
import { PlatformService } from "../services/platform.service";
import { QrPlatformService } from "../services/qr-platform.service";
export declare class TicketsController {
    private readonly platform;
    private readonly qrPlatform;
    constructor(platform: PlatformService, qrPlatform: QrPlatformService);
    verify(dto: ApiVerifyQrDto, apiKey: string | undefined, idempotencyKey: string | undefined, req: Request): Promise<any>;
    revoke(id: string, apiKey: string | undefined): Promise<{
        revoked: boolean;
        ticket_id: any;
        jti: any;
        revoked_at: string;
    }>;
}
