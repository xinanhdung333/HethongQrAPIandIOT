import { Request, Response } from "express";
import { BuyProductDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";
export declare class ProductsController {
    private readonly platform;
    private readonly auth;
    private readonly activity;
    constructor(platform: PlatformService, auth: AuthService, activity: ActivityLogService);
    products(authorization: string | undefined, req: Request, res: Response): Promise<any>;
    buy(id: string, dto: BuyProductDto, authorization: string | undefined, req: Request, res: Response): Promise<{
        order_id: any;
        payment_demo_url: string;
        total: number;
    } | undefined>;
    private allowCustomerOnly;
}
