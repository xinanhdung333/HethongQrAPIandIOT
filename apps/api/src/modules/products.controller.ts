import { Body, Controller, Get, Headers, Param, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Request, Response } from "express";
import { BuyProductDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly platform: PlatformService, private readonly auth: AuthService, private readonly activity: ActivityLogService) {}

  @Get()
  async products(@Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const products = await this.platform.products();
    await this.activity.record({ session, action: "VIEW_PRODUCTS", targetType: "Product", metadata: { count: products.length }, req });
    return products;
  }

  @Post(":id/buy")
  async buy(@Param("id") id: string, @Body() dto: BuyProductDto, @Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const result = await this.platform.buyProduct(id, dto, session.sub);
    await this.activity.record({ session, action: "BUY_PRODUCT", targetType: "RentalOrder", targetId: result.order_id, metadata: { product_id: id, quantity: dto.quantity, total: result.total }, req });
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
