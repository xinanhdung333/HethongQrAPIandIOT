import { Body, Controller, Get, Headers, NotFoundException, Param, Patch, Post, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Prisma, ShowStatus } from "@prisma/client";
import { AdminCreateApiKeyDto, AdminUpdateProductDto, AdminUpdateShowDto, AdminUpdateStaticPageDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ApiKeyIssuanceService } from "../services/api-key-issuance.service";
import { PrismaService } from "../services/prisma.service";
import { RedisService } from "../services/redis.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly redis: RedisService, private readonly keys: ApiKeyIssuanceService) {}

  @Get("summary")
  async summary(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const [users, products, rentals, shows, ticketOrders, tickets, apiKeys, payouts, staticPages, activityLogs] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count(),
      this.prisma.rentalOrder.count(),
      this.prisma.show.count(),
      this.prisma.ticketOrder.count(),
      this.prisma.ticket.count(),
      this.prisma.apiKey.count(),
      this.prisma.payout.count(),
      this.prisma.staticPage.count(),
      this.prisma.activityLog.count()
    ]);
    const revenue = await this.prisma.ticketOrder.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmount: true, payoutAmount: true, platformFee: true }
    });
    return {
      counts: { users, products, rentals, shows, ticketOrders, tickets, apiKeys, payouts, staticPages, activityLogs },
      revenue: {
        total: revenue._sum.totalAmount ?? 0,
        payout: revenue._sum.payoutAmount ?? 0,
        fee: revenue._sum.platformFee ?? 0
      }
    };
  }

  @Get("users")
  async users(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });
  }

  @Get("products")
  async products(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.product.findMany({ orderBy: [{ type: "asc" }, { priceSell: "asc" }] });
  }

  @Patch("products/:id")
  async updateProduct(@Param("id") id: string, @Body() dto: AdminUpdateProductDto, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price_sell !== undefined) data.priceSell = dto.price_sell;
    if (dto.price_rent_month !== undefined) data.priceRentMonth = dto.price_rent_month;
    if (dto.deposit_fee !== undefined) data.depositFee = dto.deposit_fee;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.images !== undefined) data.images = dto.images as Prisma.InputJsonValue;
    const product = await this.prisma.product.update({ where: { id }, data });
    await this.redis.del("cache:products");
    return product;
  }

  @Get("orders")
  async orders(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.rentalOrder.findMany({
      include: { product: true, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  @Get("shows")
  async shows(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.show.findMany({
      include: { owner: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  @Patch("shows/:id/status")
  async updateShowStatus(@Param("id") id: string, @Body() dto: AdminUpdateShowDto, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    if (!Object.values(ShowStatus).includes(dto.status as ShowStatus)) throw new NotFoundException("Trạng thái show không hợp lệ");
    return this.prisma.show.update({ where: { id }, data: { status: dto.status as ShowStatus } });
  }

  @Get("tickets")
  async tickets(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.ticketOrder.findMany({
      include: { show: true, tickets: true, payouts: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  @Get("api-keys")
  async apiKeys(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.apiKey.findMany({
      select: { id: true, prefix: true, quota: true, userId: true, rentalId: true, scopes: true, rateLimit: true, createdAt: true, user: { select: { email: true } }, rental: { select: { appName: true, plan: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  @Get("activity-logs")
  async activityLogs(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.activityLog.findMany({
      include: { user: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  @Post("api-keys")
  async createApiKey(@Body() dto: AdminCreateApiKeyDto, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const user = await this.prisma.user.findUnique({ where: { id: dto.user_id } });
    if (!user) throw new NotFoundException("Không tìm thấy user");
    const rental = await this.prisma.apiRentalOrder.findFirst({ where: { id: dto.rental_id, userId: user.id } });
    const scopes = Array.isArray(rental?.scopes) ? rental.scopes : [];
    const issued = await this.keys.issueKey({ userId: user.id, rentalId: dto.rental_id, scopes: scopes as never[], source: "admin" });
    return { ...issued.key, api_key_once: issued.api_key_once };
  }

  @Get("static-pages")
  async staticPages(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.staticPage.findMany({ orderBy: { sortOrder: "asc" } });
  }

  @Patch("static-pages/:slug")
  async updateStaticPage(@Param("slug") slug: string, @Body() dto: AdminUpdateStaticPageDto, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const data: Prisma.StaticPageUpdateInput = {};
    if (dto.nav_label !== undefined) data.navLabel = dto.nav_label;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.hero_image !== undefined) data.heroImage = dto.hero_image;
    if (dto.cta_primary !== undefined) data.ctaPrimary = dto.cta_primary as Prisma.InputJsonValue;
    if (dto.cta_secondary !== undefined) data.ctaSecondary = dto.cta_secondary as Prisma.InputJsonValue;
    if (dto.sections !== undefined) data.sections = dto.sections as Prisma.InputJsonValue;
    if (dto.sort_order !== undefined) data.sortOrder = dto.sort_order;
    if (dto.published !== undefined) data.published = dto.published;
    return this.prisma.staticPage.update({ where: { slug }, data });
  }

  private async assertAdmin(authorization?: string) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Admin cần DATABASE_URL thật. Hãy chạy PostgreSQL/Redis và migrate DB.");
    }
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Missing admin token");
    const decoded = await this.auth.verifyJwt<{ sub: string; email: string; role: string; jti: string }>(token);
    if (decoded.role !== "ADMIN") throw new UnauthorizedException("Admin role required");
    return decoded;
  }
}
