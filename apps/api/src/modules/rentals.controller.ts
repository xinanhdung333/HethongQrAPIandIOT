import { Body, Controller, Get, Headers, Param, Patch, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Request, Response } from "express";
import { RentalDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";

@Controller("rentals")
export class RentalsController {
  constructor(private readonly platform: PlatformService, private readonly auth: AuthService, private readonly activity: ActivityLogService) {}

  @Get()
  async list(@Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const rentals = await this.platform.listRentals(session.sub);
    await this.activity.record({ session, action: "LIST_RENTALS", targetType: "RentalOrder", metadata: { count: rentals.length }, req });
    return rentals;
  }

  @Get(":id")
  async detail(@Param("id") id: string, @Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const rental = await this.platform.getRental(id, session.sub);
    await this.activity.record({ session, action: "VIEW_RENTAL", targetType: "RentalOrder", targetId: id, req });
    return rental;
  }

  @Post()
  async create(@Body() dto: RentalDto, @Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const result = await this.platform.createRental(dto, session.sub);
    await this.activity.record({
      session,
      action: dto.type === "rent" ? "CREATE_RENTAL" : "BUY_PRODUCT",
      targetType: "RentalOrder",
      targetId: result.order_id,
      metadata: { product_id: dto.product_id, type: dto.type, quantity: dto.quantity, duration: dto.duration, total: result.breakdown.total },
      req
    });
    return result;
  }

  @Patch(":id/return")
  async returnOrder(@Param("id") id: string, @Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const result = await this.platform.returnRental(id, session.sub);
    await this.activity.record({ session, action: "RETURN_RENTAL", targetType: "RentalOrder", targetId: id, metadata: { status: result?.status }, req });
    return result;
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
