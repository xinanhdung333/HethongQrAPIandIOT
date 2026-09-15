import { Body, Controller, Get, Headers, Param, Patch, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Request, Response } from "express";
import { BuyTicketDto, ShowDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";

@Controller()
export class ShowsController {
  constructor(private readonly platform: PlatformService, private readonly auth: AuthService, private readonly activity: ActivityLogService) {}

  @Post("shows")
  async create(@Body() dto: ShowDto, @Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const result = await this.platform.createShow(dto, session.sub);
    await this.activity.record({
      session,
      action: "CREATE_SHOW",
      targetType: "Show",
      targetId: result.show_id,
      metadata: { name: dto.name, location: dto.location, ticket_price: dto.ticket_price, total_tickets: dto.total_tickets },
      req
    });
    return result;
  }

  @Patch("shows/:id/end")
  async end(@Param("id") id: string, @Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const result = await this.platform.endShow(id, session.sub);
    await this.activity.record({ session, action: "END_SHOW", targetType: "Show", targetId: id, metadata: { status: result?.status }, req });
    return result;
  }

  @Get("e/:slug")
  show(@Param("slug") slug: string) {
    return this.platform.getShow(slug);
  }

  @Post("e/:slug/buy")
  buy(@Param("slug") slug: string, @Body() dto: BuyTicketDto) {
    return this.platform.buyTickets(slug, dto);
  }

  private async allowCustomerOnly(authorization: string | undefined, res: Response) {
    const session = await this.auth.sessionFromAuthorization(authorization);
    if (!session) {
      throw new UnauthorizedException("Login required");
    }
    if (session.role === "ADMIN") {
      res.status(204).send();
      return null;
    }
    return session;
  }
}
