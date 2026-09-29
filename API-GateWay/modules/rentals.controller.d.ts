import { Request, Response } from "express";
import { RentalDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";
export declare class RentalsController {
    private readonly platform;
    private readonly auth;
    private readonly activity;
    constructor(platform: PlatformService, auth: AuthService, activity: ActivityLogService);
    list(authorization: string | undefined, req: Request, res: Response): Promise<any>;
    detail(id: string, authorization: string | undefined, req: Request, res: Response): Promise<any>;
    create(dto: RentalDto, authorization: string | undefined, req: Request, res: Response): Promise<{
        order_id: any;
        payment_demo_url: string;
        breakdown: {
            rent_fee: number;
            deposit_fee: number;
            install_fee: number;
            sell_fee: number;
            total: number;
        };
    } | undefined>;
    returnOrder(id: string, authorization: string | undefined, req: Request, res: Response): Promise<any>;
    private allowCustomerOnly;
}
