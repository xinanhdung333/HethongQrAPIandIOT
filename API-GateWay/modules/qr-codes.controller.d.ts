import { Response } from "express";
import { ApiBulkCreateQrDto, ApiCreateQrDto } from "../api-qr.dto";
import { QrPlatformService } from "../services/qr-platform.service";
export declare class QrCodesController {
    private readonly platform;
    constructor(platform: QrPlatformService);
    create(dto: ApiCreateQrDto, apiKey?: string, idempotencyKey?: string): Promise<any>;
    bulk(dto: ApiBulkCreateQrDto, apiKey?: string, idempotencyKey?: string): Promise<any>;
    get(id: string, headerApiKey: string | undefined): Promise<any>;
    revoke(id: string, headerApiKey: string | undefined, idempotencyKey?: string): Promise<any>;
    svg(id: string, headerApiKey: string | undefined, res: Response): Promise<Response<any, Record<string, any>>>;
    private forward;
}
