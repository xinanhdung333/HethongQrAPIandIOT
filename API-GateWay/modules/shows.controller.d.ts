import { Request, Response } from "express";
import { BuyTicketDto, ShowDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";
export declare class ShowsController {
    private readonly platform;
    private readonly auth;
    private readonly activity;
    constructor(platform: PlatformService, auth: AuthService, activity: ActivityLogService);
    create(dto: ShowDto, authorization: string | undefined, req: Request, res: Response): Promise<{
        show_id: any;
        public_url: string;
        embed_code: string;
    } | undefined>;
    end(id: string, authorization: string | undefined, req: Request, res: Response): Promise<any>;
    show(slug: string): Promise<any>;
    buy(slug: string, dto: BuyTicketDto): Promise<{
        payment_url: string;
        order_id: any;
    }>;
    private allowCustomerOnly;
}
