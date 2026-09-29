import { Request } from "express";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";
export declare class DashboardController {
    private readonly platform;
    private readonly auth;
    private readonly activity;
    constructor(platform: PlatformService, auth: AuthService, activity: ActivityLogService);
    dashboard(authorization: string | undefined, req: Request): Promise<{
        rentals: any;
        apiRentals: any;
        shows: any;
        apiKeys: any;
        ticketOrders: any;
        purchasedTicketOrders: any;
        payouts: any;
        tickets: any;
        externalQrCodes: any;
    }>;
}
