import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { OrderType, Prisma, ProductType, RentalStatus, TicketOrderStatus, UserRole } from "@prisma/client";
import crypto from "crypto";
import QRCode from "qrcode";
import { AuthService, FULL_API_KEY_SCOPES } from "../security/auth.service";
import { ApiKeyScope } from "../security/api-key.decorator";
import { getGateKeyPairForTenant, signOfflineQrToken } from "../security/gate-signing";
import { gateRedisTenantId } from "../security/gate-tenant";
import { enableOfflineCapable, isOfflineCapable } from "../security/tenant";
import { ApiRentalDto, BuyProductDto, CreateExternalQrDto, LoginDto, RegisterDto, RentalDto, ShowDto, UpdateApiKeyScopesDto, UpdateProfileDto, VerifyTicketDto } from "../dto";
import { PayosMockService } from "./payos.mock";
import { ApiKeyIssuanceService } from "./api-key-issuance.service";
import { PrismaService } from "./prisma.service";
import { RedisService } from "./redis.service";
import { RealtimeGateway } from "./realtime.gateway";
import { parseCallbackUrl } from "./safe-http";
import { SystemSettingsService } from "./system-settings.service";

const INSTALL_FEE = 300000;
const PLATFORM_FEE_RATE = 0.05;
const API_PLAN_PRICES = { starter: 199000, business: 499000 };
const API_PLAN_QUOTAS = { starter: 5000, business: 30000 };
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
const GATE_USED_TTL_SECONDS = 60 * 60 * 24 * 400;
const TICKET_RESERVATION_MINUTES = 10;

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeGateway,
    private readonly payos: PayosMockService,
    private readonly settings: SystemSettingsService,
    private readonly keys: ApiKeyIssuanceService
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException("Email da ton tai");
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash: await this.auth.hashPassword(dto.password), role: UserRole.CUSTOMER },
      select: { id: true, email: true, role: true }
    });
    const token = await this.auth.signJwt({ sub: user.id, email: user.email, role: user.role }, 60 * 60 * 24);
    return { user: this.authUser(user), access_token: token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true, email: true, role: true, passwordHash: true } });
    if (!user || !(await this.auth.comparePassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Email hoac mat khau khong dung");
    }
    const token = await this.auth.signJwt({ sub: user.id, email: user.email, role: user.role }, 60 * 60 * 24);
    return { user: this.authUser(user), access_token: token };
  }

  async me(token: string) {
    const decoded = await this.auth.verifyJwt<{ sub: string; email: string; role: string; jti: string }>(token);
    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, fullName: true, phone: true, addressLine: true, provinceName: true, provinceCode: true, districtName: true, districtCode: true, wardName: true, wardCode: true }
    });
    if (!user) throw new UnauthorizedException("Tai khoan khong con ton tai");
    return { user: this.profileUser(user) };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profileFields: Array<keyof UpdateProfileDto> = [
      "email", "password", "fullName", "phone", "addressLine", "provinceName", "provinceCode",
      "districtName", "districtCode", "wardName", "wardCode"
    ];
    if (!profileFields.some((field) => dto[field] !== undefined)) {
      throw new BadRequestException("No profile changes provided");
    }
    const data: Prisma.UserUpdateInput = {};
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing && existing.id !== userId) throw new BadRequestException("Email da ton tai");
      data.email = dto.email;
    }
    if (dto.password) data.passwordHash = await this.auth.hashPassword(dto.password);
    const addressFields = [
      "fullName", "phone", "addressLine", "provinceName", "provinceCode",
      "districtName", "districtCode", "wardName", "wardCode"
    ] as const;
    for (const field of addressFields) {
      if (dto[field] !== undefined) data[field] = dto[field]?.trim() || null;
    }
    const user = await this.prisma.user.update({
      where: { id: userId }, data,
      select: { id: true, email: true, role: true, fullName: true, phone: true, addressLine: true, provinceName: true, provinceCode: true, districtName: true, districtCode: true, wardName: true, wardCode: true }
    });
    const token = await this.auth.signJwt({ sub: user.id, email: user.email, role: user.role }, 60 * 60 * 24);
    return { user: this.profileUser(user), access_token: token };
  }

  async logout(token: string) {
    return this.auth.revokeJwt(token);
  }

  async products() {
    const cached = await this.redis.get("cache:products");
    if (cached) return JSON.parse(cached);
    const products = await this.prisma.product.findMany({ orderBy: { priceSell: "asc" } });
    await this.redis.set("cache:products", JSON.stringify(products), 60 * 5);
    return products;
  }

  async buyProduct(productId: string, dto: BuyProductDto, userId: string) {
    const result = await this.prisma.$transaction(async tx => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new NotFoundException("Product not found");
      const reserved = await tx.product.updateMany({ where: { id: productId, stock: { gte: dto.quantity } }, data: { stock: { decrement: dto.quantity } } });
      if (!reserved.count) throw new BadRequestException("Khong du ton kho");
      const total = product.priceSell * dto.quantity;
      const order = await tx.rentalOrder.create({
        data: { userId, productId, type: OrderType.BUY, duration: 0, quantity: dto.quantity, rentFee: 0, depositFee: 0, installFee: 0, total, status: RentalStatus.PENDING, shippingAddress: dto.shipping_address as Prisma.InputJsonValue, gateIds: [] }
      });
      return { order, total };
    });
    const { order, total } = result;
    const paymentMethod = dto.payment_method ?? "payos_demo";
    const payment = await this.payos.createPaymentLink({ orderId: order.id, amount: total, kind: "rental", method: paymentMethod });
    if (paymentMethod === "payos_demo") setTimeout(() => void this.markRentalPaid(order.id), 5000);
    await this.redis.del("cache:products");
    return { order_id: order.id, payment_demo_url: payment.paymentUrl, total };
  }

  async createRental(dto: RentalDto, userId: string) {
    if (!dto.agree_damage_terms) throw new BadRequestException("Must agree to damage terms");
    const isRent = dto.type === "rent";
    const startDate = isRent ? new Date(`${dto.start_date ?? ""}T00:00:00.000Z`) : null;
    if (isRent && (!dto.start_date || !startDate || Number.isNaN(startDate.getTime()) || startDate <= new Date())) {
      throw new BadRequestException("Ngày bắt đầu thuê phải là ngày trong tương lai");
    }
    if (isRent && ![1, 3, 12].includes(dto.duration)) throw new BadRequestException("Duration must be 1, 3, or 12 months");
    const depositPercent = isRent ? 10 : 0;
    const result = await this.prisma.$transaction(async tx => {
      const product = await tx.product.findUnique({ where: { id: dto.product_id } });
      if (!product) throw new NotFoundException("Product not found");
      if (isRent && (product.productType === "LINH_KIEN" || product.productType === "THIET_BI_BAN" || product.type === ProductType.COMPONENT)) {
        throw new BadRequestException("Only rental equipment can be rented");
      }
      if (isRent && product.priceRentMonth <= 0) throw new BadRequestException("Product is not available for rent");
      const reserved = await tx.product.updateMany({ where: { id: dto.product_id, stock: { gte: dto.quantity } }, data: { stock: { decrement: dto.quantity } } });
      if (!reserved.count) throw new BadRequestException("Khong du ton kho");
      const rentFee = isRent ? product.priceRentMonth * dto.duration * dto.quantity : 0;
      const sellFee = isRent ? 0 : product.priceSell * dto.quantity;
      const installFee = isRent ? INSTALL_FEE : 0;
      const total = rentFee + installFee + sellFee;
      const depositAmount = isRent ? Math.round(total * depositPercent / 100) : 0;
      const depositFee = depositAmount;
      const paymentDueAt = startDate ? new Date(startDate.getTime() - 24 * 60 * 60 * 1000) : null;
      const order = await tx.rentalOrder.create({
      data: { userId, productId: product.id, type: isRent ? OrderType.RENT : OrderType.BUY, duration: dto.duration, quantity: dto.quantity, rentFee, depositFee, installFee, total, startDate, paymentDueAt, depositAmount, depositPercent, remainingAmount: Math.max(0, total - depositAmount), remainingPaymentStatus: isRent && total > depositAmount ? "PENDING" : "NOT_REQUIRED", shippingAddress: dto.shipping_address as Prisma.InputJsonValue, gateIds: [], status: RentalStatus.PENDING }
      });
      return { order, rentFee, depositFee, sellFee, installFee, total, depositAmount, paymentDueAt };
    });
    const { order, rentFee, depositFee, sellFee, installFee, total, depositAmount, paymentDueAt } = result;
    await this.redis.del("cache:products");
    const paymentMethod = dto.payment_method ?? "payos_demo";
    const payment = await this.payos.createPaymentLink({ orderId: order.id, amount: isRent ? depositAmount : total, kind: "rental", method: paymentMethod, stage: "initial" });
    return {
      order_id: order.id,
      payment_demo_url: payment.paymentUrl,
      breakdown: {
        rent_fee: rentFee,
        deposit_fee: depositFee,
        install_fee: installFee,
        sell_fee: sellFee,
        total,
        deposit_amount: depositAmount,
        deposit_percent: depositPercent,
        payment_due_at: paymentDueAt?.toISOString() ?? null,
        start_date: startDate?.toISOString() ?? null
      }
    };
  }

  async listRentals(userId: string) {
    return this.prisma.rentalOrder.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async getRental(id: string, userId: string) {
    const order = await this.prisma.rentalOrder.findFirst({
      where: { id, userId },
      include: { product: true }
    });
    if (!order) throw new NotFoundException("Rental not found");
    return order;
  }

  async createPayosDemoQr(orderId: string, kind: "rental" | "ticket" | "api", stage: "initial" | "remaining") {
    let amount: number;
    if (kind === "rental") {
      const order = await this.prisma.rentalOrder.findUnique({ where: { id: orderId }, select: { type: true, total: true, depositAmount: true, remainingAmount: true } });
      if (!order) throw new NotFoundException("Payment order not found");
      amount = stage === "remaining" ? order.remainingAmount : order.type === OrderType.RENT ? order.depositAmount : order.total;
    } else if (kind === "ticket") {
      const order = await this.prisma.ticketOrder.findUnique({ where: { id: orderId }, select: { totalAmount: true } });
      if (!order) throw new NotFoundException("Payment order not found");
      amount = order.totalAmount;
    } else {
      const order = await this.prisma.apiRentalOrder.findUnique({ where: { id: orderId }, select: { total: true } });
      if (!order) throw new NotFoundException("Payment order not found");
      amount = order.total;
    }
    if (!Number.isInteger(amount) || amount < 1) throw new BadRequestException("Payment amount is invalid");

    const configuredBank = process.env.PAYOS_RECEIVER_BANK_NAME?.trim();
    const configuredAccountNumber = process.env.PAYOS_RECEIVER_ACCOUNT_NUMBER?.trim();
    if (Boolean(configuredBank) !== Boolean(configuredAccountNumber)) {
      throw new BadRequestException({ error: "payment_receiver_not_configured", message: "Cần cấu hình đồng thời PAYOS_RECEIVER_BANK_NAME và PAYOS_RECEIVER_ACCOUNT_NUMBER." });
    }
    if (!configuredBank || !configuredAccountNumber) {
      throw new BadRequestException({ error: "payment_receiver_not_configured", message: "Cần cấu hình PAYOS_RECEIVER_BANK_NAME và PAYOS_RECEIVER_ACCOUNT_NUMBER trong apps/api/.env để tạo mã VietQR." });
    }

    return this.payos.createVietQrImage({
      bankName: configuredBank,
      accountNumber: configuredAccountNumber,
      accountName: process.env.PAYOS_RECEIVER_ACCOUNT_NAME?.trim() ?? "",
      amount,
      orderId
    });
  }

  async createRemainingRentalPayment(id: string, userId: string, method: "payos_demo" | "momo" = "payos_demo") {
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException("Rental not found");
    if (order.type !== OrderType.RENT) throw new ForbiddenException("Only rental orders can pay remaining balance");
    const remaining = order.remainingAmount;
    if (!remaining) throw new BadRequestException("Rental has no remaining balance");
    const paymentWindow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (order.startDate && order.startDate > paymentWindow) {
      throw new BadRequestException("Chi duoc thanh toan phan con lai trong vong 24 gio truoc ngay thue");
    }
    const payment = await this.payos.createPaymentLink({ orderId: order.id, amount: remaining, kind: "rental", method, stage: "remaining", gatewayOrderId: method === "momo" ? `${order.id}-remaining-${Date.now()}` : undefined });
    if (payment) setTimeout(() => void this.markRentalPaid(order.id), 5000);
    return { order_id: order.id, payment_demo_url: payment.paymentUrl, remaining_amount: remaining };
  }

  async confirmRemainingPaymentDemo(id: string, userId: string) {
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, userId } });
    if (!order || order.type !== OrderType.RENT) throw new NotFoundException("Rental not found");
    return this.markRentalPaid(id, "remaining");
  }

  async createShow(dto: ShowDto, userId: string) {
    const slug = await this.uniqueSlug(dto.name);
    const show = await this.prisma.show.create({
      data: {
        ownerId: userId,
        slug,
        name: dto.name,
        description: dto.description ?? "",
        bannerUrl: dto.banner || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1600&q=80",
        themeColor: dto.theme_color,
        location: dto.location,
        startAt: new Date(dto.start_at),
        endAt: dto.end_at ? new Date(dto.end_at) : null,
        ticketPrice: dto.ticket_price,
        totalTickets: dto.total_tickets,
        payoutAccount: dto.payout_account as Prisma.InputJsonValue
      }
    });
    try {
      await enableOfflineCapable(this.prisma, userId, userId);
      await getGateKeyPairForTenant(this.prisma, userId);
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : "Cannot prepare offline gate keys for show");
    }
    return {
      show_id: show.id,
      public_url: `/e/${show.slug}`,
      embed_code: `<iframe src="${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/e/${show.slug}" width="100%" height="720"></iframe>`
    };
  }

  async endShow(id: string, userId: string) {
    const result = await this.prisma.show.updateMany({ where: { id, ownerId: userId }, data: { status: "ENDED" } });
    if (!result.count) throw new NotFoundException("Show not found");
    return this.prisma.show.findUnique({
      where: { id },
      select: { id: true, slug: true, name: true, status: true, soldTickets: true, totalTickets: true, startAt: true, endAt: true }
    });
  }

  async revealShowTickets(userId: string, showId: string, orderId: string, password: string) {
    const order = await this.prisma.ticketOrder.findFirst({
      where: { id: orderId, showId, show: { ownerId: userId } },
      select: {
        id: true,
        status: true,
        quantity: true,
        totalAmount: true,
        payoutAmount: true,
        buyerName: true,
        buyerEmail: true,
        buyerPhone: true,
        buyerNote: true,
        createdAt: true,
        show: { select: { id: true, name: true, slug: true, startAt: true, location: true } },
        tickets: { select: { id: true, qrJwt: true, qrOfflineJwt: true, isUsed: true } }
      }
    });
    if (!order) throw new NotFoundException({ error: "ticket_order_not_found", message: "Ticket order not found" });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await this.auth.comparePassword(password, user.passwordHash))) {
      throw new ForbiddenException({ error: "reauth_failed", message: "Account password is invalid" });
    }

    return { order };
  }

  async createShowScanKey(showId: string, userId: string) {
    const issued = await this.prisma.$transaction(tx => this.keys.issueKey({
      userId,
      showId,
      scopes: ["ticket:verify"],
      source: "self",
      tx
    }));
    return { api_key_once: issued.api_key_once, show_id: showId, key_prefix: issued.key.prefix };
  }

  async returnRental(id: string, userId: string) {
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, userId }, select: { id: true, productId: true, quantity: true, status: true, type: true } });
    if (!order) throw new NotFoundException("Rental not found");
    if (order.status !== RentalStatus.ACTIVE) throw new ForbiddenException({ error: "rental_not_active", message: "Only active rentals can be returned" });
    if (order.type !== OrderType.RENT) throw new ForbiddenException({ error: "not_rental_order", message: "Only rental orders can be returned" });
    const returned = await this.prisma.$transaction(async tx => {
      const result = await tx.rentalOrder.updateMany({ where: { id, userId, status: RentalStatus.ACTIVE }, data: { status: RentalStatus.RETURNED } });
      if (!result.count) throw new ForbiddenException({ error: "rental_not_active", message: "Only active rentals can be returned" });
      await tx.product.update({ where: { id: order.productId }, data: { stock: { increment: order.quantity } } });
      return tx.rentalOrder.findUnique({ where: { id } });
    });
    await this.redis.del("cache:products");
    return returned;
  }

  async getShow(slug: string) {
    const cacheKey = `cache:show:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const show = await this.prisma.show.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, name: true, description: true, bannerUrl: true, themeColor: true,
        location: true, startAt: true, endAt: true, ticketPrice: true, totalTickets: true,
        soldTickets: true, status: true
      }
    });
    if (!show) throw new NotFoundException("Show not found");
    await this.redis.set(cacheKey, JSON.stringify(show), 60 * 2);
    return show;
  }

  async buyTickets(slug: string, buyer: { buyer_name: string; buyer_email: string; buyer_phone: string; buyer_note?: string; quantity: number; payment_method?: "payos_demo" | "momo" }) {
    if (!Number.isInteger(buyer.quantity) || buyer.quantity < 1) throw new BadRequestException("Quantity must be at least 1");
    const reservation = await this.withTicketReservationLock(slug, () => this.prisma.$transaction(async tx => {
      const show = await tx.show.findUnique({ where: { slug } });
      if (!show) throw new NotFoundException("Show not found");
      await tx.$queryRaw`SELECT id FROM "shows" WHERE id = ${show.id} FOR UPDATE`;
      const now = new Date();
      const expiredOrders = await tx.ticketOrder.findMany({ where: { showId: show.id, status: TicketOrderStatus.PENDING, reservationExpiresAt: { lte: now } }, select: { id: true, quantity: true } });
      let released = 0;
      for (const expired of expiredOrders) {
        const expiredResult = await tx.ticketOrder.updateMany({ where: { id: expired.id, status: TicketOrderStatus.PENDING }, data: { status: TicketOrderStatus.EXPIRED } });
        if (expiredResult.count) released += expired.quantity;
      }
      if (released) await tx.show.update({ where: { id: show.id }, data: { reservedTickets: { decrement: released } } });
      const available = show.totalTickets - show.soldTickets - show.reservedTickets + released;
      if (available < buyer.quantity) throw new BadRequestException("Sold out");
      const reservationExpiresAt = new Date(now.getTime() + TICKET_RESERVATION_MINUTES * 60 * 1000);
      const totalAmount = show.ticketPrice * buyer.quantity;
      const platformFee = Math.round(totalAmount * PLATFORM_FEE_RATE);
      await tx.show.update({ where: { id: show.id }, data: { reservedTickets: { increment: buyer.quantity } } });
      const order = await tx.ticketOrder.create({
        data: { showId: show.id, buyerName: buyer.buyer_name, buyerEmail: buyer.buyer_email, buyerPhone: buyer.buyer_phone, buyerNote: buyer.buyer_note?.trim() || null, quantity: buyer.quantity, totalAmount, platformFee, payoutAmount: totalAmount - platformFee, reservationExpiresAt }
      });
      return { order, totalAmount };
    }));
    let payment;
    try {
      payment = await this.payos.createPaymentLink({ orderId: reservation.order.id, amount: reservation.totalAmount, kind: "ticket", method: buyer.payment_method ?? "payos_demo" });
      await this.prisma.ticketOrder.update({ where: { id: reservation.order.id }, data: { payosPaymentId: payment.paymentId } });
    } catch (error) {
      await this.releaseTicketReservation(reservation.order.id);
      throw error;
    }
    const order = reservation.order;
    if ((buyer.payment_method ?? "payos_demo") === "payos_demo") setTimeout(() => void this.markTicketOrderPaid(order.id), 5000);
    return { payment_url: payment.paymentUrl, order_id: order.id };
  }

  async cancelRentalWithRefund(id: string, userId: string) {
    const order = await this.prisma.rentalOrder.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException("Rental not found");
    if (order.type !== OrderType.RENT || order.status !== RentalStatus.DEPOSIT_PAID) throw new ForbiddenException("Only unpaid remaining rentals can be cancelled with refund");
    if (order.paymentDueAt && order.paymentDueAt <= new Date()) throw new ForbiddenException("Cancellation refund window has expired");
    return this.prisma.$transaction(async tx => {
      const updated = await tx.rentalOrder.updateMany({ where: { id, userId, status: RentalStatus.DEPOSIT_PAID }, data: { status: RentalStatus.CANCELLED, remainingPaymentStatus: "NOT_REQUIRED", depositRefundedAt: new Date() } });
      if (!updated.count) throw new ForbiddenException("Rental can no longer be cancelled");
      await tx.product.update({ where: { id: order.productId }, data: { stock: { increment: order.quantity } } });
      return tx.rentalOrder.findUnique({ where: { id } });
    });
  }

  private async releaseTicketReservation(orderId: string) {
    await this.prisma.$transaction(async tx => {
      const order = await tx.ticketOrder.findUnique({ where: { id: orderId }, select: { showId: true, quantity: true, status: true } });
      if (!order || order.status !== TicketOrderStatus.PENDING) return;
      await tx.$queryRaw`SELECT id FROM "shows" WHERE id = ${order.showId} FOR UPDATE`;
      const released = await tx.ticketOrder.updateMany({ where: { id: orderId, status: TicketOrderStatus.PENDING }, data: { status: TicketOrderStatus.EXPIRED } });
      if (released.count) await tx.show.update({ where: { id: order.showId }, data: { reservedTickets: { decrement: order.quantity } } });
    });
  }

  private async withTicketReservationLock<T>(showKey: string, work: () => Promise<T>): Promise<T> {
    const key = `ticket:reservation:lock:${showKey}`;
    const token = crypto.randomUUID();
    const lockTtlSeconds = 5;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await this.redis.setIfAbsent(key, token, lockTtlSeconds)) {
        try {
          return await work();
        } finally {
          await this.redis.releaseIfValue(key, token);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    // DB row locking remains the final safety net if Redis is unavailable or saturated.
    return work();
  }

  async markRentalPaid(orderId: string, stage: "initial" | "remaining" = "initial") {
    const order = await this.prisma.rentalOrder.findUnique({ where: { id: orderId } });
    if (stage === "remaining") {
      if (!order || order.type !== OrderType.RENT) return order;
      const paidAt = new Date();
      const shouldActivate = order.status === RentalStatus.DEPOSIT_PAID || order.status === RentalStatus.PENDING;
      return this.prisma.rentalOrder.update({ where: { id: orderId }, data: { remainingPaidAmount: order.remainingAmount, remainingPaymentStatus: "PAID", remainingPaidAt: paidAt, ...(shouldActivate && order.status === RentalStatus.DEPOSIT_PAID ? { status: RentalStatus.ACTIVE } : {}) } });
    }
    if (!order || order.status !== RentalStatus.PENDING) return order;
    const nextStatus = order.type === OrderType.BUY ? RentalStatus.PAID : (order.startDate && order.startDate > new Date() ? RentalStatus.DEPOSIT_PAID : RentalStatus.ACTIVE);
    const claimed = await this.prisma.rentalOrder.updateMany({
      where: { id: orderId, status: RentalStatus.PENDING },
      data: {
        status: nextStatus,
        ...(order.type === OrderType.RENT ? { gateIds: Array.from({ length: order.quantity }, (_, index) => `gate-${order.id.slice(0, 5)}-${index + 1}`) } : {})
      }
    });
    if (!claimed.count) return this.prisma.rentalOrder.findUnique({ where: { id: orderId } });
    const paid = await this.prisma.rentalOrder.findUnique({ where: { id: orderId } });
    this.realtime.emitTicketVerified(order.userId, { type: order.type === OrderType.BUY ? "product:paid" : "rental:active", order_id: orderId });
    return paid;
  }

  async listApiRentals(userId: string) {
    return this.prisma.apiRentalOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async createApiRental(dto: ApiRentalDto, userId: string) {
    const duration = [1, 3, 12].includes(dto.duration) ? dto.duration : 1;
    const platformSettings = await this.settings.apiPlatform();
    const plan = platformSettings.plan_limits[dto.plan];
    const monthlyPrice = plan?.price ?? API_PLAN_PRICES[dto.plan];
    const quota = plan?.quota ?? API_PLAN_QUOTAS[dto.plan];
    const scopes = dto.scopes?.length ? dto.scopes : [];
    if (!scopes.length) throw new BadRequestException({ error: "invalid_scopes", message: "Choose at least one API key scope" });
    const total = monthlyPrice * duration;
    const callbackUrl = dto.callback_url?.trim() || null;
    if (callbackUrl) {
      try { parseCallbackUrl(callbackUrl); }
      catch (error) { throw new BadRequestException({ error: "invalid_callback_url", message: error instanceof Error ? error.message : "Invalid callback URL" }); }
    }
    const order = await this.prisma.apiRentalOrder.create({
      data: {
        userId,
        appName: dto.app_name.trim(),
        website: dto.website?.trim() || null,
        callbackUrl,
        plan: dto.plan,
        duration,
        quota,
        scopes,
        total
      }
    });
    const payment = await this.payos.createPaymentLink({ orderId: order.id, amount: total, kind: "api", method: dto.payment_method ?? "payos_demo" });
    await this.prisma.apiRentalOrder.update({ where: { id: order.id }, data: { payosPaymentId: payment.paymentId } });
    return {
      payment_url: payment.paymentUrl,
      order_id: order.id,
      breakdown: { monthly_price: monthlyPrice, duration, quota, total }
    };
  }

  async markApiRentalPaid(orderId: string) {
    const order = await this.prisma.apiRentalOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== RentalStatus.PENDING) return order;
    const result = await this.prisma.$transaction(async tx => {
      const claimed = await tx.apiRentalOrder.updateMany({ where: { id: orderId, status: RentalStatus.PENDING }, data: { status: RentalStatus.ACTIVE } });
      if (!claimed.count) return { claimed: false, paid: await tx.apiRentalOrder.findUnique({ where: { id: orderId } }), issued: null };
      const paid = await tx.apiRentalOrder.findUniqueOrThrow({ where: { id: orderId } });
      const issued = await this.keys.issueKey({
        userId: order.userId,
        rentalId: order.id,
        scopes: (Array.isArray(order.scopes) ? order.scopes : FULL_API_KEY_SCOPES) as never[],
        quota: order.quota,
        source: "self",
        tx
      });
      return { claimed: true, paid, issued };
    });
    if (!result.claimed || !result.issued) return result.paid;
    this.realtime.emitTicketVerified(order.userId, { type: "api_rental:active", order_id: orderId, api_key_prefix: result.issued.key.prefix });
    return { ...result.paid, apiKeyPrefix: result.issued.key.prefix, api_key_once: result.issued.api_key_once };
  }

  async updateApiKeyScopes(id: string, userId: string, dto: UpdateApiKeyScopesDto) {
    if (!dto.scopes.length) throw new BadRequestException({ error: "invalid_scopes", message: "API key must have at least one scope" });
    const key = await this.prisma.apiKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException({ error: "api_key_not_found", message: "API key not found" });
    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { scopes: Array.from(new Set(dto.scopes)) }
    });
    return this.publicApiKey(updated);
  }

  async createExternalQrCode(dto: CreateExternalQrDto, apiKey?: string) {
    if (!apiKey) throw new UnauthorizedException("Missing API key");
    const key = await this.assertApiKey(apiKey);
    const ttlSeconds = Math.min(Math.max(dto.ttl_seconds ?? 60 * 60 * 24 * 30, 60), 60 * 60 * 24 * 365);
    const jti = crypto.randomBytes(18).toString("hex");
    const code = `SQR-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const qrJwt = await this.auth.signQrJwt({
      sub: `external:${dto.resource_type}:${dto.resource_id}`,
      type: "external_qr",
      owner_id: key.userId,
      resource_type: dto.resource_type,
      resource_id: dto.resource_id,
      customer_ref: dto.customer_ref,
      jti
    }, ttlSeconds);
    const created = await this.prisma.externalQrCode.create({
      data: {
        userId: key.userId,
        apiKeyId: key.id,
        jti,
        code,
        qrJwt,
        resourceType: dto.resource_type,
        resourceId: dto.resource_id,
        customerRef: dto.customer_ref?.trim() || null,
        payload: dto.payload ? dto.payload as Prisma.InputJsonValue : Prisma.JsonNull,
        expiresAt
      }
    });
    const imageUrl = `${API_PUBLIC_URL}/api/v1/qr-codes/${created.id}/svg`;
    return {
      id: created.id,
      type: "external_qr",
      qr_jwt: created.qrJwt,
      ticket_code: created.code,
      qr: {
        value: created.qrJwt,
        format: "jwt",
        code: created.code,
        image_url: imageUrl
      },
      resource: {
        type: created.resourceType,
        id: created.resourceId,
        customer_ref: created.customerRef
      },
      expires_at: created.expiresAt
    };
  }

  async getExternalQrSvg(id: string, apiKey?: string) {
    if (!apiKey) throw new UnauthorizedException("Missing API key");
    const key = await this.assertApiKey(apiKey, "qr:read");
    const code = await this.prisma.externalQrCode.findUnique({ where: { id } });
    if (!code || code.userId !== key.userId) throw new NotFoundException("QR code not found");
    return QRCode.toString(code.qrJwt, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 2,
      width: 256,
      color: {
        dark: "#18181b",
        light: "#ffffff"
      }
    });
  }

  async markTicketOrderPaid(orderId: string) {
    const order = await this.prisma.ticketOrder.findUnique({ where: { id: orderId }, include: { show: true, tickets: true } });
    if (!order || order.status === TicketOrderStatus.PAID) return order;
    const tenantId = order.show.ownerId;
    const offlineCapable = await isOfflineCapable(this.prisma, tenantId);
    const preparedTickets: Array<{ showId: string; ticketOrderId: string; jti: string; qrJwt: string; qrOfflineJwt: string | null }> = [];
    for (let i = 0; i < order.quantity; i += 1) {
      const jti = crypto.randomBytes(18).toString("hex");
      const showEndAt = order.show.endAt ?? order.show.startAt;
      const expiresAt = new Date(showEndAt.getTime() + 24 * 60 * 60 * 1000);
      const ttlSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
      const qrJwt = await this.auth.signQrJwt({ sub: `ticket:${order.id}:${i + 1}`, show_id: order.showId, buyer: order.buyerEmail, type: "ticket", jti }, ttlSeconds);
      const qrOfflineJwt = offlineCapable
        ? await signOfflineQrToken(this.prisma, {
          jti,
          resourceType: "ticket",
          resourceId: `${order.id}:${i + 1}`,
          expiresAt,
          notBefore: null,
          isTest: false,
          subjectPrefix: "ticket",
          type: "ticket_offline"
        }, tenantId)
        : null;
      preparedTickets.push({ showId: order.showId, ticketOrderId: order.id, jti, qrJwt, qrOfflineJwt });
    }
    const result = await this.prisma.$transaction(async tx => {
      // Claim the order atomically so duplicate payment webhooks cannot issue tickets twice.
      const claimed = await tx.ticketOrder.updateMany({
        where: { id: orderId, status: TicketOrderStatus.PENDING, OR: [{ reservationExpiresAt: null }, { reservationExpiresAt: { gt: new Date() } }] },
        data: { status: TicketOrderStatus.PAID }
      });
      if (!claimed.count) {
        const expired = await tx.ticketOrder.updateMany({ where: { id: orderId, status: TicketOrderStatus.PENDING, reservationExpiresAt: { lte: new Date() } }, data: { status: TicketOrderStatus.EXPIRED } });
        if (expired.count) await tx.show.update({ where: { id: order.showId }, data: { reservedTickets: { decrement: order.quantity } } });
        return { claimed: false, order: await tx.ticketOrder.findUnique({ where: { id: orderId }, include: { show: true, tickets: true } }) };
      }
      await tx.ticket.createMany({ data: preparedTickets });
      const inventory = await tx.show.updateMany({ where: { id: order.showId, reservedTickets: { gte: order.quantity } }, data: { reservedTickets: { decrement: order.quantity }, soldTickets: { increment: order.quantity } } });
      if (!inventory.count) throw new BadRequestException("Ticket reservation is no longer available");
      const show = await tx.show.findUniqueOrThrow({ where: { id: order.showId }, select: { soldTickets: true } });
      await tx.payout.create({ data: { showOwnerId: order.show.ownerId, ticketOrderId: order.id, amount: order.payoutAmount } });
      return {
        claimed: true,
        soldTickets: show.soldTickets,
        order: await tx.ticketOrder.findUnique({ where: { id: orderId }, include: { show: true, tickets: true } })
      };
    });
    if (!result.order) return null;
    if (!result.claimed) return result.order;
    await this.redis.del(`cache:show:${order.show.slug}`);
    this.realtime.emitTicketSold(order.showId, { order_id: orderId, quantity: order.quantity, sold_tickets: result.soldTickets, payout_amount: order.payoutAmount });
    return result.order;
  }

  async webhook(orderId: string, kind?: "rental" | "ticket" | "api", stage: "initial" | "remaining" = "initial") {
    if (kind === "rental") return this.markRentalPaid(orderId, stage);
    if (kind === "ticket") return this.markTicketOrderPaid(orderId);
    if (kind === "api") return this.markApiRentalPaid(orderId);
    const ticket = await this.prisma.ticketOrder.findUnique({ where: { id: orderId } });
    if (ticket) return this.markTicketOrderPaid(orderId);
    const apiRental = await this.prisma.apiRentalOrder.findUnique({ where: { id: orderId } });
    if (apiRental) return this.markApiRentalPaid(orderId);
    return this.markRentalPaid(orderId);
  }

  async verifyTicket(dto: VerifyTicketDto, apiKey?: string, requestMeta?: { ip?: string; userAgent?: string }) {
    const key = apiKey ? await this.assertApiKey(apiKey) : null;
    let ticketToken = dto.qr_jwt ?? dto.ticket_code;
    if (!ticketToken) throw new BadRequestException("qr_jwt or ticket_code is required");
    if (dto.ticket_code && !dto.ticket_code.includes(".")) {
      const external = await this.prisma.externalQrCode.findUnique({ where: { code: dto.ticket_code }, include: { apiKey: true } });
      if (!external) throw new UnauthorizedException("Code not found");
      if (key?.showId) throw new ForbiddenException({ error: "show_key_external_qr", message: "Show scanner keys can only verify tickets for their show" });
      if (key && external.userId !== key.userId) throw new UnauthorizedException("API key cannot verify this QR code");
      if (await this.redis.get(`gate:used:${gateRedisTenantId(external.apiKey, "external_qr")}:${external.jti}`)) {
        await this.recordExternalQrScan(external.id, external.userId, dto.gate_id, false, "QR code already used", requestMeta);
        return { valid: false, reason: "QR code already used" };
      }
      if (external.expiresAt.getTime() < Date.now()) {
        await this.recordExternalQrScan(external.id, external.userId, dto.gate_id, false, "QR code expired", requestMeta);
        return { valid: false, reason: "QR code expired" };
      }
      if (external.isUsed) {
        await this.recordExternalQrScan(external.id, external.userId, dto.gate_id, false, "QR code already used", requestMeta);
        return { valid: false, reason: "QR code already used" };
      }
      ticketToken = external.qrJwt;
    }
    const decoded = await this.auth.verifyQrJwt<{ jti: string; show_id?: string; buyer?: string; type?: string; owner_id?: string; resource_type?: string; resource_id?: string; customer_ref?: string }>(ticketToken);
    if (decoded.type === "external_qr") {
      const external = await this.prisma.externalQrCode.findFirst({ where: { qrJwt: ticketToken }, include: { apiKey: true } });
      if (!external || external.jti !== decoded.jti) throw new UnauthorizedException("QR code not found");
      if (key?.showId) throw new ForbiddenException({ error: "show_key_external_qr", message: "Show scanner keys can only verify tickets for their show" });
      if (external.revokedAt || await this.prisma.revokedResource.findUnique({ where: { resourceType_jti: { resourceType: "external_qr", jti: external.jti } } })) {
        return { valid: false, reason: "QR code revoked" };
      }
      if (key && external.userId !== key.userId) throw new UnauthorizedException("API key cannot verify this QR code");
      const externalGateUsedKey = `gate:used:${gateRedisTenantId(external.apiKey, "external_qr")}:${decoded.jti}`;
      if (await this.redis.get(externalGateUsedKey)) {
        await this.recordExternalQrScan(external.id, external.userId, dto.gate_id, false, "QR code already used", requestMeta);
        return { valid: false, reason: "QR code already used" };
      }
      if (external.expiresAt.getTime() < Date.now()) {
        await this.recordExternalQrScan(external.id, external.userId, dto.gate_id, false, "QR code expired", requestMeta);
        return { valid: false, reason: "QR code expired" };
      }
      if (external.isUsed) {
        await this.recordExternalQrScan(external.id, external.userId, dto.gate_id, false, "QR code already used", requestMeta);
        return { valid: false, reason: "QR code already used" };
      }
      const now = new Date();
      const marked = await this.prisma.externalQrCode.updateMany({ where: { id: external.id, isUsed: false }, data: { isUsed: true, usedAt: now, useCount: { increment: 1 } } });
      if (!marked.count) {
        await this.recordExternalQrScan(external.id, external.userId, dto.gate_id, false, "QR code already used", requestMeta);
        return { valid: false, reason: "QR code already used" };
      }
      await this.recordExternalQrScan(external.id, external.userId, dto.gate_id, true, null, requestMeta);
      await this.redis.set(externalGateUsedKey, `${dto.gate_id}|${now.toISOString()}`, GATE_USED_TTL_SECONDS);
      await this.redis.del(`jwt:jti:${decoded.jti}`);
      const result = {
        valid: true,
        type: "external_qr",
        qr_id: external.id,
        gate_id: dto.gate_id,
        resource_type: external.resourceType,
        resource_id: external.resourceId,
        customer_ref: external.customerRef,
        payload: external.payload
      };
      void this.notifyExternalQrWebhook(external.userId, external.apiKey.prefix, result);
      this.realtime.emitTicketVerified(external.userId, { type: "external_qr:verified", qr_id: external.id, gate_id: dto.gate_id, resource_id: external.resourceId });
      return result;
    }
    const ticket = await this.prisma.ticket.findFirst({ where: { qrJwt: ticketToken }, include: { show: true } });
    if (!ticket || ticket.jti !== decoded.jti) throw new UnauthorizedException("Ticket not found");
    if (key && key.showId && key.showId !== ticket.showId) {
      throw new ForbiddenException({ error: "show_key_mismatch", message: "This scanner key is not authorized for this show" });
    }
    if (key && !key.showId && key.rentalId) {
      throw new ForbiddenException({ error: "show_key_required", message: "Show tickets require the scanner key issued for that show" });
    }
    if (await this.prisma.revokedResource.findUnique({ where: { resourceType_jti: { resourceType: "ticket", jti: ticket.jti } } })) {
      return { valid: false, reason: "Ticket revoked" };
    }
    const ticketGateUsedKey = `gate:used:${gateRedisTenantId({ userId: ticket.show.ownerId }, "ticket")}:${decoded.jti}`;
    if (await this.redis.get(ticketGateUsedKey)) return { valid: false, reason: "Ticket already used" };
    if (ticket.isUsed) return { valid: false, reason: "Ticket already used" };
    const now = new Date();
    const marked = await this.prisma.ticket.updateMany({ where: { id: ticket.id, isUsed: false }, data: { isUsed: true, usedAt: now, useCount: { increment: 1 } } });
    if (!marked.count) return { valid: false, reason: "Ticket already used" };
    await this.redis.set(ticketGateUsedKey, `${dto.gate_id}|${now.toISOString()}`, GATE_USED_TTL_SECONDS);
    await this.redis.del(`jwt:jti:${decoded.jti}`);
    this.realtime.emitTicketVerified(ticket.show.ownerId, { ticket_id: ticket.id, gate_id: dto.gate_id, show_id: ticket.showId });
    return { valid: true, ticket_id: ticket.id, show_id: ticket.showId, gate_id: dto.gate_id, buyer: decoded.buyer };
  }

  async revokeTicket(id: string, apiKey?: string) {
    if (!apiKey) throw new UnauthorizedException("Missing API key");
    const key = await this.assertApiKey(apiKey, "qr:create");
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: { show: true } });
    if (!ticket || ticket.show.ownerId !== key.userId) throw new NotFoundException("Ticket not found");
    const revokedAt = new Date();
    await this.prisma.revokedResource.upsert({
      where: { resourceType_jti: { resourceType: "ticket", jti: ticket.jti } },
      create: { resourceType: "ticket", jti: ticket.jti, revokedAt, tenantId: ticket.show.ownerId, showId: ticket.showId, userId: ticket.show.ownerId, isTest: false },
      update: { revokedAt, showId: ticket.showId }
    });
    return { revoked: true, ticket_id: ticket.id, jti: ticket.jti, revoked_at: revokedAt.toISOString() };
  }

  async dashboard(userId: string, requestedView?: string) {
    const view = requestedView ?? "overview";
    const user = view === "tickets"
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      : { email: "" };
    if (view === "tickets" && !user) throw new NotFoundException("User not found");

    const empty = { rentals: [], apiRentals: [], shows: [], apiKeys: [], ticketOrders: [], purchasedTicketOrders: [], payouts: [], tickets: [], externalQrCodes: [] };
    if (view === "rentals") {
      return { ...empty, rentals: await this.prisma.rentalOrder.findMany({ where: { userId }, select: { id: true, type: true, status: true, total: true, quantity: true, duration: true, startDate: true, paymentDueAt: true, depositAmount: true, remainingAmount: true, remainingPaidAmount: true, remainingPaymentStatus: true, gateIds: true, createdAt: true, product: { select: { name: true, type: true } } }, orderBy: { createdAt: "desc" } }) };
    }
    if (view === "api-rentals") {
      return { ...empty, apiRentals: await this.prisma.apiRentalOrder.findMany({ where: { userId }, select: { id: true, appName: true, website: true, plan: true, duration: true, quota: true, scopes: true, total: true, status: true, apiKeyPrefix: true, createdAt: true }, orderBy: { createdAt: "desc" } }) };
    }
    if (view === "tickets") {
      const purchasedTicketOrders = await this.prisma.ticketOrder.findMany({
        where: { buyerEmail: user!.email }, orderBy: { createdAt: "desc" },
        select: { id: true, status: true, quantity: true, totalAmount: true, buyerName: true, buyerEmail: true, createdAt: true, show: { select: { id: true, name: true, startAt: true } }, tickets: { select: { id: true, qrJwt: true, qrOfflineJwt: true, isUsed: true } } }
      });
      return { ...empty, purchasedTicketOrders };
    }
    if (view === "shows") {
      const [shows, apiKeys, ticketOrders] = await Promise.all([
        this.prisma.show.findMany({ where: { ownerId: userId }, select: { id: true, slug: true, name: true, status: true, installationStatus: true, scannerCount: true, installationNote: true, soldTickets: true, totalTickets: true, ticketPrice: true, location: true, startAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
        this.prisma.apiKey.findMany({ where: { userId }, select: { id: true, prefix: true, quota: true, scopes: true, rentalId: true, showId: true, status: true, isTest: true, allowedIps: true, rateLimit: true, revokeAt: true, suspendUntil: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
        this.prisma.ticketOrder.findMany({ where: { show: { ownerId: userId } }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, quantity: true, totalAmount: true, payoutAmount: true, buyerName: true, buyerEmail: true, buyerPhone: true, buyerNote: true, createdAt: true, show: { select: { id: true, name: true, slug: true, startAt: true, location: true } }, tickets: { select: { id: true, isUsed: true } } } })
      ]);
      return { ...empty, shows, apiKeys: apiKeys.map(key => this.publicApiKey(key)), ticketOrders };
    }

    const [rentals, apiRentals, shows, apiKeys, ticketOrders, payouts, tickets, externalQrCodes] = await Promise.all([
      this.prisma.rentalOrder.findMany({ where: { userId }, select: { id: true, type: true, status: true, total: true, quantity: true, duration: true, gateIds: true, createdAt: true, product: { select: { name: true, type: true } } }, orderBy: { createdAt: "desc" } }),
      this.prisma.apiRentalOrder.findMany({ where: { userId }, select: { id: true, appName: true, plan: true, duration: true, quota: true, total: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.show.findMany({ where: { ownerId: userId }, select: { id: true, slug: true, name: true, status: true, soldTickets: true, totalTickets: true, ticketPrice: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.apiKey.findMany({ where: { userId }, select: { id: true, prefix: true, quota: true, scopes: true, rentalId: true, showId: true, status: true, isTest: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.ticketOrder.findMany({ where: { show: { ownerId: userId } }, select: { id: true, status: true, quantity: true, totalAmount: true, buyerName: true, buyerEmail: true, createdAt: true, show: { select: { id: true, name: true } }, tickets: { select: { isUsed: true } } }, orderBy: { createdAt: "desc" } }),
      this.prisma.payout.findMany({ where: { showOwnerId: userId }, select: { id: true, amount: true, status: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.ticket.findMany({ where: { show: { ownerId: userId } }, select: { id: true, isUsed: true, qrOfflineJwt: true, show: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
      this.prisma.externalQrCode.findMany({ where: { userId }, select: { id: true, code: true, resourceType: true, resourceId: true, customerRef: true, isUsed: true, expiresAt: true, createdAt: true, scanLogs: { select: { id: true, gateId: true, valid: true, reason: true, ip: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 3 } }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    return {
      rentals,
      apiRentals,
      shows,
      apiKeys: apiKeys.map(key => this.publicApiKey(key)),
      ticketOrders,
      purchasedTicketOrders: [],
      payouts,
      tickets: tickets.map(({ qrOfflineJwt, ...ticket }) => ({ ...ticket, hasOfflineQr: Boolean(qrOfflineJwt) })),
      externalQrCodes
    };
  }

  private async assertApiKey(raw: string, requiredScope?: ApiKeyScope) {
    const keyHash = this.auth.hashApiKey(raw);
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!key) throw new UnauthorizedException("Invalid API key");
    if (requiredScope && !this.auth.apiKeyHasScope(key.scopes, requiredScope)) {
      throw new ForbiddenException({
        error: "forbidden_scope",
        message: `API key does not have '${requiredScope}' permission`
      });
    }
    return key;
  }

  private async recordExternalQrScan(externalQrId: string, userId: string, gateId: string, valid: boolean, reason: string | null, requestMeta?: { ip?: string; userAgent?: string }) {
    await this.prisma.externalQrScanLog.create({
      data: {
        externalQrId,
        userId,
        gateId,
        valid,
        reason,
        ip: requestMeta?.ip,
        userAgent: requestMeta?.userAgent
      }
    });
  }

  private async notifyExternalQrWebhook(userId: string, apiKeyPrefix: string, payload: Record<string, unknown>) {
    const apiRental = await this.prisma.apiRentalOrder.findFirst({
      where: { userId, apiKeyPrefix, status: RentalStatus.ACTIVE, callbackUrl: { not: null } },
      orderBy: { createdAt: "desc" }
    });
    if (!apiRental?.callbackUrl) return;
    try {
      await fetch(apiRental.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-SMARTQR-EVENT": "qr.verified" },
        body: JSON.stringify({ event: "qr.verified", created_at: new Date().toISOString(), ...payload })
      });
    } catch {
      // Webhook delivery is best-effort in the Phase 1 demo.
    }
  }

  private publicApiKey(key: { id: string; userId?: string; prefix: string; quota: number; scopes: unknown; rentalId?: string | null; showId?: string | null; status?: string; isTest?: boolean; allowedIps?: unknown; rateLimit?: number; revokeAt?: Date | null; suspendUntil?: Date | null; createdAt: Date }) {
    return {
      id: key.id,
      prefix: key.prefix,
      quota: key.quota,
      scopes: Array.isArray(key.scopes) ? key.scopes : FULL_API_KEY_SCOPES,
      rentalId: key.rentalId ?? null,
      showId: key.showId ?? null,
      status: key.status ?? "active",
      isTest: key.isTest ?? false,
      allowedIps: Array.isArray(key.allowedIps) ? key.allowedIps : [],
      rateLimit: key.rateLimit ?? 60,
      revokeAt: key.revokeAt ?? null,
      suspendUntil: key.suspendUntil ?? null,
      createdAt: key.createdAt
    };
  }

  private async ensureDemoUser() {
    const existing = await this.prisma.user.findUnique({ where: { email: "demo@smartqr.vn" } });
    if (existing) return existing.id;
    const passwordHash = await this.auth.hashPassword("demo123456");
    const user = await this.prisma.user.create({ data: { email: "demo@smartqr.vn", passwordHash } });
    return user.id;
  }

  private authUser(user: { id: string; email: string; role: string }) {
    return { id: user.id, email: user.email, role: user.role };
  }

  private profileUser(user: {
    id: string;
    email: string;
    role: string;
    fullName?: string | null;
    phone?: string | null;
    addressLine?: string | null;
    provinceName?: string | null;
    provinceCode?: string | null;
    districtName?: string | null;
    districtCode?: string | null;
    wardName?: string | null;
    wardCode?: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName ?? null,
      phone: user.phone ?? null,
      addressLine: user.addressLine ?? null,
      provinceName: user.provinceName ?? null,
      provinceCode: user.provinceCode ?? null,
      districtName: user.districtName ?? null,
      districtCode: user.districtCode ?? null,
      wardName: user.wardName ?? null,
      wardCode: user.wardCode ?? null
    };
  }

  private async uniqueSlug(name: string) {
    const base = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || `show-${crypto.randomBytes(4).toString("hex")}`;
    let slug = base;
    let index = 1;
    while (await this.prisma.show.findUnique({ where: { slug } })) {
      slug = `${base}-${index}`;
      index += 1;
    }
    return slug;
  }
}
