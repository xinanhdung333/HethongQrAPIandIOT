import { Controller, Get, Headers, Req, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly platform: PlatformService, private readonly auth: AuthService, private readonly activity: ActivityLogService) {}

  @Get()
  async dashboard(@Headers("authorization") authorization: string | undefined, @Req() req: Request) {
    const session = await this.auth.sessionFromAuthorization(authorization);
    if (!session) {
      throw new UnauthorizedException("Login required");
    }
    const data = await this.platform.dashboard(session.sub);
    await this.activity.record({ session, action: "VIEW_DASHBOARD", targetType: "Dashboard", metadata: { rentals: data.rentals.length, shows: data.shows.length }, req });
    return data;
  }
}
