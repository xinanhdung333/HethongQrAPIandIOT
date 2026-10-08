import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Headers, NotFoundException, Param, Patch, Post, Put, Query, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { OrderType, Prisma, ProductType, RentalStatus, ShowStatus, UserRole } from "@prisma/client";
import { AdminCreateApiKeyDto, AdminCreateProductDto, AdminUpdateProductDto, AdminUpdateShowDto, AdminUpdateStaticPageDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ApiKeyIssuanceService } from "../services/api-key-issuance.service";
import { PrismaService } from "../services/prisma.service";
import { RedisService } from "../services/redis.service";
import { ActivityLogService } from "../services/activity-log.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly redis: RedisService, private readonly keys: ApiKeyIssuanceService, private readonly activity: ActivityLogService) {}

  @Get("summary")
  async summary(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const day = new Date().toISOString().slice(0, 10);
    const [users, products, rentals, shows, ticketOrders, tickets, apiKeys, payouts, staticPages, activityLogs, previousHits, sha256Hits] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count(),
      this.prisma.rentalOrder.count(),
      this.prisma.show.count(),
      this.prisma.ticketOrder.count(),
      this.prisma.ticket.count(),
      this.prisma.apiKey.count(),
      this.prisma.payout.count(),
      this.prisma.staticPage.count(),
      this.prisma.activityLog.count(),
      this.redis.get(`apikey:legacy-hash:count:previous:${day}`),
      this.redis.get(`apikey:legacy-hash:count:sha256:${day}`)
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
      },
      legacy_api_key_hashes: {
        previous_hits_today: Number(previousHits ?? "0"),
        sha256_hits_today: Number(sha256Hits ?? "0")
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

  @Post("users")
  async createUser(@Body() body: { email?: string; password?: string; role?: string }, @Headers("authorization") authorization?: string) {
    const admin = await this.assertAdmin(authorization);
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException("Email không hợp lệ");
    if (!body.password || body.password.length < 8) throw new BadRequestException("Mật khẩu cần ít nhất 8 ký tự");
    const role = (body.role ?? "CUSTOMER") as UserRole;
    if (!Object.values(UserRole).includes(role)) throw new BadRequestException("Vai trò không hợp lệ");
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new ConflictException("Email đã được sử dụng");
    const user = await this.prisma.user.create({ data: { email, role, passwordHash: await this.auth.hashPassword(body.password) }, select: { id: true, email: true, role: true, createdAt: true } });
    await this.activity.record({ session: admin, action: "ADMIN_CREATE_USER", targetType: "User", targetId: user.id, metadata: { email, role } });
    return user;
  }

  @Patch("users/:id")
  async updateUser(@Param("id") id: string, @Body() body: { email?: string; role?: string; password?: string }, @Headers("authorization") authorization?: string) {
    const admin = await this.assertAdmin(authorization);
    if (id === admin.sub && body.role && body.role !== "ADMIN") throw new BadRequestException("Không thể tự hạ quyền admin đang đăng nhập");
    const data: Prisma.UserUpdateInput = {};
    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException("Email không hợp lệ");
      data.email = email;
    }
    if (body.role !== undefined) {
      if (!Object.values(UserRole).includes(body.role as UserRole)) throw new BadRequestException("Vai trò không hợp lệ");
      data.role = body.role as UserRole;
    }
    if (body.password !== undefined) {
      if (body.password.length < 8) throw new BadRequestException("Mật khẩu cần ít nhất 8 ký tự");
      data.passwordHash = await this.auth.hashPassword(body.password);
    }
    const user = await this.prisma.user.update({ where: { id }, data, select: { id: true, email: true, role: true, createdAt: true } });
    await this.activity.record({ session: admin, action: "ADMIN_UPDATE_USER", targetType: "User", targetId: id, metadata: { email_changed: body.email !== undefined, role_changed: body.role !== undefined, password_changed: body.password !== undefined } });
    return user;
  }

  @Delete("users/:id")
  async deleteUser(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    const admin = await this.assertAdmin(authorization);
    if (id === admin.sub) throw new BadRequestException("Không thể xóa tài khoản admin đang đăng nhập");
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, _count: { select: { rentals: true, scheduledRentals: true, inventoryLogs: true, shows: true, apiKeys: true, apiRentals: true, externalQrCodes: true, externalQrScanLogs: true, payoutAccounts: true, paymentTransactions: true, apiNotifications: true, payouts: true, activityLogs: true, revokedResources: true } } } });
    if (!user) throw new NotFoundException("Không tìm thấy người dùng");
    if (Object.entries(user._count).some(([relation, count]) => relation !== "activityLogs" && count > 0)) throw new ConflictException("Tài khoản đã có giao dịch hoặc dữ liệu nghiệp vụ nên không thể xóa an toàn.");
    await this.prisma.user.delete({ where: { id } });
    await this.activity.record({ session: admin, action: "ADMIN_DELETE_USER", targetType: "User", targetId: id, metadata: { email: user.email } });
    return { deleted: true, id };
  }

  @Get("products")
  async products(@Query("product_type") productType?: string, @Query("category_id") categoryId?: string, @Query("q") q?: string, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const typeMap: Record<string, string> = { linh_kien: "LINH_KIEN", thiet_bi_ban: "THIET_BI_BAN", thiet_bi_thue: "THIET_BI_THUE" };
    return this.prisma.product.findMany({ where: { ...(productType && typeMap[productType] ? { productType: typeMap[productType] as never } : {}), ...(categoryId ? { categoryId } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}) }, include: { category: true, saleDetails: true, rentalDetails: true }, orderBy: { name: "asc" } });
  }

  @Get("products/:id")
  async product(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.product.findUniqueOrThrow({ where: { id }, include: { category: true, saleDetails: true, rentalDetails: true } });
  }

  @Get("categories")
  async categories(@Headers("authorization") authorization?: string) { await this.assertAdmin(authorization); return this.prisma.productCategory.findMany({ select: { id: true, name: true, slug: true, parentId: true }, orderBy: { name: "asc" } }); }

  @Post("categories")
  async createCategory(@Body() body: { name?: string; slug?: string; parent_id?: string }, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization); if (!body.name?.trim()) throw new BadRequestException("Tên danh mục bắt buộc");
    return this.prisma.productCategory.create({ data: { name: body.name.trim(), slug: body.slug?.trim() || body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), ...(body.parent_id ? { parent: { connect: { id: body.parent_id } } } : {}) } });
  }

  @Patch("categories/:id")
  async updateCategory(@Param("id") id: string, @Body() body: { name?: string; slug?: string; parent_id?: string | null }, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization); return this.prisma.productCategory.update({ where: { id }, data: { ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.slug !== undefined ? { slug: body.slug.trim() } : {}), ...(body.parent_id !== undefined ? { parentId: body.parent_id } : {}) } });
  }

  @Delete("categories/:id")
  async deleteCategory(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const category = await this.prisma.productCategory.findUnique({ where: { id }, select: { id: true, _count: { select: { products: true, children: true } } } });
    if (!category) throw new NotFoundException("Không tìm thấy danh mục");
    if (category._count.products || category._count.children) throw new ConflictException("Danh mục đang có sản phẩm hoặc danh mục con, không thể xóa.");
    await this.prisma.productCategory.delete({ where: { id } }); return { deleted: true };
  }

  @Get("components/inventory")
  async componentInventory(@Headers("authorization") authorization?: string) { await this.assertAdmin(authorization); return this.prisma.product.findMany({ where: { productType: "LINH_KIEN" as never }, include: { saleDetails: true }, orderBy: { name: "asc" } }); }

  @Post("components/:id/stock")
  async adjustComponentStock(@Param("id") id: string, @Body() body: { quantity?: number; reason?: string }, @Headers("authorization") authorization?: string) {
    const admin = await this.assertAdmin(authorization); const quantity = Number(body.quantity); if (!Number.isInteger(quantity) || quantity === 0) throw new BadRequestException("Số lượng không hợp lệ");
    return this.prisma.$transaction(async tx => { const detail = await tx.productSaleDetails.findUnique({ where: { productId: id } }); if (!detail) throw new NotFoundException("Không có tồn kho linh kiện"); const next = detail.soLuongTon + quantity; if (next < 0) throw new BadRequestException("Tồn kho không đủ"); await tx.productSaleDetails.update({ where: { productId: id }, data: { soLuongTon: next } }); await tx.inventoryLog.create({ data: { productId: id, quantity, reason: body.reason, userId: admin.sub } }); return { product_id: id, so_luong_ton: next }; });
  }

  @Get("components/:id/compatibility")
  async compatibility(@Param("id") id: string, @Headers("authorization") authorization?: string) { await this.assertAdmin(authorization); return this.prisma.productCompatibility.findMany({ where: { componentId: id }, include: { device: true } }); }

  @Put("components/:id/compatibility")
  async saveCompatibility(@Param("id") id: string, @Body() body: { device_ids?: string[] }, @Headers("authorization") authorization?: string) { await this.assertAdmin(authorization); const ids = Array.isArray(body.device_ids) ? body.device_ids : []; await this.prisma.$transaction([this.prisma.productCompatibility.deleteMany({ where: { componentId: id } }), ...ids.map(deviceId => this.prisma.productCompatibility.create({ data: { componentId: id, deviceId } }))]); return this.prisma.productCompatibility.findMany({ where: { componentId: id } }); }

  @Get("rental/units")
  async rentalUnits(@Headers("authorization") authorization?: string) { await this.assertAdmin(authorization); return this.prisma.rentalUnit.findMany({ include: { product: true, rentals: { include: { rental: { include: { customer: { select: { fullName: true, email: true } } } } }, where: { rental: { status: { in: ["DA_DUYET", "DANG_THUE"] as never[] } } } } }, orderBy: { serial: "asc" } }); }

  @Patch("rental/units/:id/status")
  async updateRentalUnit(@Param("id") id: string, @Body() body: { status?: string }, @Headers("authorization") authorization?: string) { await this.assertAdmin(authorization); if (!["SAN_SANG", "DANG_THUE", "BAO_TRI"].includes(body.status ?? "")) throw new BadRequestException("Trạng thái máy không hợp lệ"); return this.prisma.rentalUnit.update({ where: { id }, data: { status: body.status as never } }); }

  @Get("rentals")
  async scheduledRentals(@Query("status") status?: string, @Headers("authorization") authorization?: string) { await this.assertAdmin(authorization); return this.prisma.rental.findMany({ where: status ? { status: status as never } : undefined, include: { product: true, customer: { select: { id: true, email: true, fullName: true, phone: true } }, units: { include: { unit: true } } }, orderBy: { tuNgay: "asc" } }); }

  @Get("rentals/:id")
  async scheduledRental(@Param("id") id: string, @Headers("authorization") authorization?: string) { await this.assertAdmin(authorization); return this.prisma.rental.findUniqueOrThrow({ where: { id }, include: { product: true, customer: true, units: { include: { unit: true } } } }); }

  @Patch("rentals/:id/workflow")
  async rentalWorkflow(@Param("id") id: string, @Body() body: { action?: "approve" | "deliver" | "return" }, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization); const next = body.action === "approve" ? "DA_DUYET" : body.action === "deliver" ? "DANG_THUE" : body.action === "return" ? "DA_TRA" : ""; if (!next) throw new BadRequestException("Workflow không hợp lệ");
    return this.prisma.$transaction(async tx => { const rental = await tx.rental.findUnique({ where: { id }, include: { units: true } }); if (!rental) throw new NotFoundException("Không tìm thấy đơn thuê"); if (body.action === "deliver") { const unit = await tx.rentalUnit.findFirst({ where: { productId: rental.productId, status: "SAN_SANG" } }); if (!unit) throw new BadRequestException("Không còn máy sẵn sàng"); await tx.rentalUnit.update({ where: { id: unit.id }, data: { status: "DANG_THUE" } }); await tx.rentalUnitBooking.create({ data: { rentalId: id, unitId: unit.id } }); } if (body.action === "return") for (const link of rental.units) await tx.rentalUnit.update({ where: { id: link.unitId }, data: { status: "SAN_SANG" } }); return tx.rental.update({ where: { id }, data: { status: next as never } }); });
  }

  @Post("products")
  async createProduct(@Body() dto: AdminCreateProductDto, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const slug = dto.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) throw new BadRequestException("Slug san pham khong hop le");
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException("Slug san pham da ton tai");
    const product = await this.prisma.product.create({
      data: {
        slug,
        name: dto.name.trim(),
        ...(dto.category_id ? { category: { connect: { id: dto.category_id } } } : {}),
        ...(dto.product_type ? { productType: dto.product_type as never } : {}),
        type: dto.type as ProductType,
        priceSell: dto.price_sell,
        priceRentMonth: dto.price_rent_month,
        depositFee: 0,
        stock: dto.stock,
        images: dto.images as Prisma.InputJsonValue,
        specs: (dto.specs ?? {}) as Prisma.InputJsonValue
      }
    });
    await this.redis.del("cache:products");
    return product;
  }

  @Patch("products/:id")
  async updateProduct(@Param("id") id: string, @Body() dto: AdminUpdateProductDto, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) throw new BadRequestException("Slug san pham khong hop le");
      const existing = await this.prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) throw new BadRequestException("Slug san pham da ton tai");
      data.slug = slug;
    }
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category_id !== undefined) data.category = dto.category_id ? { connect: { id: dto.category_id } } : { disconnect: true };
    if (dto.product_type !== undefined) data.productType = dto.product_type as never;
    if (dto.type !== undefined) data.type = dto.type as ProductType;
    if (dto.price_sell !== undefined) data.priceSell = dto.price_sell;
    if (dto.price_rent_month !== undefined) data.priceRentMonth = dto.price_rent_month;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.images !== undefined) data.images = dto.images as Prisma.InputJsonValue;
    if (dto.specs !== undefined) data.specs = dto.specs as Prisma.InputJsonValue;
    const product = await this.prisma.product.update({ where: { id }, data });
    await this.redis.del("cache:products");
    return product;
  }

  @Delete("products/:id")
  async deleteProduct(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const product = await this.prisma.product.findUnique({ where: { id }, include: { _count: { select: { rentals: true, scheduledRentals: true, rentalUnits: true, inventoryLogs: true } } } });
    if (!product) throw new NotFoundException("Khong tim thay san pham");
    if (Object.values(product._count).some((count) => count > 0)) throw new ConflictException("Sản phẩm đã có đơn hàng, thiết bị hoặc lịch sử kho; không thể xóa.");
    await this.prisma.product.delete({ where: { id } });
    await this.redis.del("cache:products");
    return { deleted: true, id };
  }

  @Get("orders")
  async orders(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.rentalOrder.findMany({
      select: {
        id: true, type: true, status: true, quantity: true, duration: true,
        rentFee: true, depositFee: true, installFee: true, total: true,
        startDate: true, paymentDueAt: true, depositAmount: true, depositPercent: true,
        remainingAmount: true, remainingPaidAmount: true, remainingPaymentStatus: true,
        remainingPaidAt: true, depositRefundedAt: true, shippingAddress: true,
        gateIds: true, damageNotes: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, email: true, fullName: true, phone: true, addressLine: true } },
        product: { select: { id: true, name: true, slug: true, type: true, productType: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  @Patch("orders/:id/status")
  async updateOrderStatus(@Param("id") id: string, @Body() body: { status?: string }, @Headers("authorization") authorization?: string) {
    const admin = await this.assertAdmin(authorization);
    const allowed = Object.values(RentalStatus);
    if (!body.status || !allowed.includes(body.status as RentalStatus)) throw new BadRequestException("Trang thai don hang khong hop le");
    const order = await this.prisma.rentalOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Khong tim thay don hang");
    const nextStatus = body.status as RentalStatus;
    const validForType = order.type === OrderType.RENT
      ? [RentalStatus.PENDING, RentalStatus.DEPOSIT_PAID, RentalStatus.DEPOSIT_FORFEITED, RentalStatus.PAID, RentalStatus.SHIPPED, RentalStatus.ACTIVE, RentalStatus.RETURNED, RentalStatus.CANCELLED]
      : [RentalStatus.PENDING, RentalStatus.PAID, RentalStatus.SHIPPED, RentalStatus.CANCELLED];
    if (!validForType.includes(nextStatus)) throw new BadRequestException("Trang thai khong phu hop loai don hang");
    if ((order.status === RentalStatus.CANCELLED || order.status === RentalStatus.RETURNED) && nextStatus !== order.status) {
      throw new BadRequestException("Don hang da ket thuc, khong the doi trang thai");
    }
    const restoreStock = (nextStatus === RentalStatus.CANCELLED && order.status !== RentalStatus.CANCELLED && order.status !== RentalStatus.RETURNED)
      || (nextStatus === RentalStatus.RETURNED && order.type === OrderType.RENT && order.status !== RentalStatus.RETURNED);
    const updated = await this.prisma.$transaction(async (tx) => {
      const value = await tx.rentalOrder.update({ where: { id }, data: { status: nextStatus } });
      if (restoreStock) await tx.product.update({ where: { id: order.productId }, data: { stock: { increment: order.quantity } } });
      return value;
    });
    await this.redis.del("cache:products");
    await this.activity.record({ session: admin, action: "UPDATE_ORDER_STATUS", targetType: "RentalOrder", targetId: id, metadata: { from: order.status, to: nextStatus, type: order.type } });
    return updated;
  }

  @Get("shows")
  async shows(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.show.findMany({
      select: {
        id: true, slug: true, name: true, status: true, soldTickets: true, totalTickets: true,
        ticketPrice: true, installationStatus: true, scannerCount: true, installationNote: true,
        owner: { select: { id: true, email: true } },
        apiKeys: { select: { prefix: true, status: true, revokeAt: true } }
      },
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

  @Post("shows/:id/scan-key")
  async createShowScanKey(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const show = await this.prisma.show.findUnique({ where: { id } });
    if (!show) throw new NotFoundException("Không tìm thấy show");
    const issued = await this.keys.issueKey({ userId: show.ownerId, showId: show.id, scopes: ["ticket:verify"], source: "admin" });
    return { api_key_once: issued.api_key_once, show_id: show.id, key_prefix: issued.key.prefix };
  }

  @Post("shows/:id/scan-key/rotate")
  async rotateShowScanKey(@Param("id") id: string, @Body() body: { grace_minutes?: number }, @Headers("authorization") authorization?: string) {
    const admin = await this.assertAdmin(authorization);
    const show = await this.prisma.show.findUnique({ where: { id } });
    if (!show) throw new NotFoundException("Không tìm thấy show");
    const graceMinutes = body?.grace_minutes ?? 60;
    if (!Number.isInteger(graceMinutes) || graceMinutes < 1 || graceMinutes > 1440) {
      throw new NotFoundException("Thời gian chuyển key phải từ 1 đến 1440 phút");
    }
    const old = await this.prisma.apiKey.findFirst({ where: { showId: show.id, status: "active" } });
    if (!old) throw new NotFoundException("Show chưa có key máy quét đang hoạt động");
    const revokeAt = new Date(Date.now() + graceMinutes * 60 * 1000);
    const issued = await this.prisma.$transaction(async tx => {
      await tx.apiKey.update({ where: { id: old.id }, data: { status: "deprecated", revokeAt } });
      return this.keys.issueKey({ userId: show.ownerId, showId: show.id, scopes: ["ticket:verify"], source: "admin", tx });
    });
    await this.activity.record({
      session: admin,
      action: "ROTATE_SHOW_SCAN_KEY",
      targetType: "ApiKey",
      targetId: old.id,
      metadata: { showId: show.id, replacementKeyId: issued.key.id, graceMinutes }
    });
    return { api_key_once: issued.api_key_once, show_id: show.id, key_prefix: issued.key.prefix, old_revoke_at: revokeAt.toISOString() };
  }

  @Patch("shows/:id/installation")
  async updateShowInstallation(@Param("id") id: string, @Body() body: { status?: string; scanner_count?: number; note?: string }, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const allowed = ["PENDING", "SCHEDULED", "INSTALLING", "READY", "BLOCKED"];
    if (body.status && !allowed.includes(body.status)) throw new NotFoundException("Trạng thái lắp đặt không hợp lệ");
    if (body.scanner_count !== undefined && (!Number.isInteger(body.scanner_count) || body.scanner_count < 0)) {
      throw new NotFoundException("Số máy quét không hợp lệ");
    }
    return this.prisma.show.update({
      where: { id },
      data: {
        ...(body.status ? { installationStatus: body.status } : {}),
        ...(body.scanner_count !== undefined ? { scannerCount: body.scanner_count } : {}),
        ...(body.note !== undefined ? { installationNote: body.note.trim() || null } : {})
      }
    });
  }

  @Get("tickets")
  async tickets(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.ticketOrder.findMany({
      select: {
        id: true, status: true, quantity: true, totalAmount: true, payoutAmount: true,
        show: { select: { name: true } },
        tickets: { select: { id: true, isUsed: true } }
      },
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
  async activityLogs(@Query("page") pageValue?: string, @Query("pageSize") pageSizeValue?: string, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const page = Math.max(1, Number.parseInt(pageValue ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(pageSizeValue ?? "50", 10) || 50));
    const total = await this.prisma.activityLog.count();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const items = await this.prisma.activityLog.findMany({
      include: { user: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize
    });
    return { items, total, page: safePage, pageSize, totalPages };
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
