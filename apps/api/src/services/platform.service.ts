import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { OrderType, Prisma, RentalStatus, TicketOrderStatus, UserRole } from "@prisma/client";
import crypto from "crypto";
import QRCode from "qrcode";
import { AuthService, FULL_API_KEY_SCOPES } from "../security/auth.service";
import { ApiKeyScope } from "../security/api-key.decorator";
import { signOfflineQrToken } from "../security/gate-signing";
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

@Injectable()
export class PlatformService {
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
      data: { email: dto.email, passwordHash: await this.auth.hashPassword(dto.password), role: UserRole.CUSTOMER }
    });
    const token = await this.auth.signJwt({ sub: user.id, email: user.email, role: user.role }, 60 * 60 * 24);
    return { user: this.publicUser(user), access_token: token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await this.auth.comparePassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Email hoac mat khau khong dung");
    }
    const token = await this.auth.signJwt({ sub: user.id, email: user.email, role: user.role }, 60 * 60 * 24);
    return { user: this.publicUser(user), access_token: token };
  }

  async me(token: string) {
    const decoded = await this.auth.verifyJwt<{ sub: string; email: string; role: string; jti: string }>(token);
    return { user: { id: decoded.sub, email: decoded.email, role: decoded.role } };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (!dto.email && !dto.password) throw new BadRequestException("No profile changes provided");
    const data: Prisma.UserUpdateInput = {};
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing && existing.id !== userId) throw new BadRequestException("Email da ton tai");
      data.email = dto.email;
    }
    if (dto.password) data.passwordHash = await this.auth.hashPassword(dto.password);
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    const token = await this.auth.signJwt({ sub: user.id, email: user.email, role: user.role }, 60 * 60 * 24);
    return { user: this.publicUser(user), access_token: token };
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
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Product not found");
    if (product.stock < dto.quantity) throw new BadRequestException("Khong du ton kho");
    const total = product.priceSell * dto.quantity;
    const order = await this.prisma.rentalOrder.create({
      data: {
        userId,
        productId: product.id,
        type: OrderType.BUY,
        duration: 0,
        quantity: dto.quantity,
        rentFee: 0,
        depositFee: 0,
        installFee: 0,
        total,
        status: RentalStatus.PENDING,
        shippingAddress: dto.shipping_address as Prisma.InputJsonValue,
        gateIds: []
      }
    });
    await this.prisma.product.update({ where: { id: product.id }, data: { stock: product.stock - dto.quantity } });
    const payment = this.payos.createPaymentLink({ orderId: order.id, amount: total, kind: "rental" });
    setTimeout(() => void this.markRentalPaid(order.id), 5000);
    await this.redis.del("cache:products");
    return { order_id: order.id, payment_demo_url: payment.paymentUrl, total };
  }

  async createRental(dto: RentalDto, userId: string) {
    if (!dto.agree_damage_terms) throw new BadRequestException("Must agree to damage terms");
    const product = await this.prisma.product.findUnique({ where: { id: dto.product_id } });
    if (!product) throw new NotFoundException("Product not found");

    const isRent = dto.type === "rent";
    if (isRent && product.priceRentMonth <= 0) throw new BadRequestException("Product is not available for rent");
    if (isRent && ![1, 3, 12].includes(dto.duration)) throw new BadRequestException("Duration must be 1, 3, or 12 months");
    if (product.stock < dto.quantity) throw new BadRequestException("Khong du ton kho");
    const rentFee = isRent ? product.priceRentMonth * dto.duration * dto.quantity : 0;
    const depositFee = isRent ? product.depositFee * dto.quantity : 0;
    const sellFee = isRent ? 0 : product.priceSell * dto.quantity;
    const total = rentFee + depositFee + (isRent ? INSTALL_FEE : 0) + sellFee;
    const order = await this.prisma.rentalOrder.create({
      data: {
        userId,
        productId: product.id,
        type: isRent ? OrderType.RENT : OrderType.BUY,
        duration: dto.duration,
        quantity: dto.quantity,
        rentFee,
        depositFee,
        installFee: isRent ? INSTALL_FEE : 0,
        total,
        shippingAddress: dto.shipping_address as Prisma.InputJsonValue,
        gateIds: [],
        status: RentalStatus.PENDING
      }
    });
    await this.prisma.product.update({ where: { id: product.id }, data: { stock: product.stock - dto.quantity } });
    await this.redis.del("cache:products");
    const payment = this.payos.createPaymentLink({ orderId: order.id, amount: total, kind: "rental" });
    setTimeout(() => void this.markRentalPaid(order.id), 5000);
    return {
      order_id: order.id,
      payment_demo_url: payment.paymentUrl,
      breakdown: {
        rent_fee: rentFee,
        deposit_fee: depositFee,
        install_fee: isRent ? INSTALL_FEE : 0,
        sell_fee: sellFee,
        total
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
        ticketPrice: dto.ticket_price,
        totalTickets: dto.total_tickets,
        payoutAccount: dto.payout_account as Prisma.InputJsonValue
      }
    });
    await enableOfflineCapable(this.prisma, userId, userId);
    return {
      show_id: show.id,
      public_url: `/e/${show.slug}`,
      embed_code: `<iframe src="${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/e/${show.slug}" width="100%" height="720"></iframe>`
    };
  }

  async endShow(id: string, userId: string) {
    const result = await this.prisma.show.updateMany({ where: { id, ownerId: userId }, data: { status: "ENDED" } });
    if (!result.count) throw new NotFoundException("Show not found");
    return this.prisma.show.findUnique({ where: { id } });
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
    const show = await this.prisma.show.findUnique({ where: { slug } });
    if (!show) throw new NotFoundException("Show not found");
    await this.redis.set(cacheKey, JSON.stringify(show), 60 * 2);
    return show;
  }

  async buyTickets(slug: string, buyer: { buyer_name: string; buyer_email: string; buyer_phone: string; buyer_note?: string; quantity: number }) {
    const show = await this.prisma.show.findUnique({ where: { slug } });
    if (!show) throw new NotFoundException("Show not found");
    if (show.soldTickets + buyer.quantity > show.totalTickets) throw new BadRequestException("Sold out");
    const totalAmount = show.ticketPrice * buyer.quantity;
    const platformFee = Math.round(totalAmount * PLATFORM_FEE_RATE);
    const order = await this.prisma.ticketOrder.create({
      data: {
        showId: show.id,
        buyerName: buyer.buyer_name,
        buyerEmail: buyer.buyer_email,
        buyerPhone: buyer.buyer_phone,
        buyerNote: buyer.buyer_note?.trim() || null,
        quantity: buyer.quantity,
        totalAmount,
        platformFee,
        payoutAmount: totalAmount - platformFee
      }
    });
    const payment = this.payos.createPaymentLink({ orderId: order.id, amount: totalAmount, kind: "ticket" });
    await this.prisma.ticketOrder.update({ where: { id: order.id }, data: { payosPaymentId: payment.paymentId } });
    setTimeout(() => void this.markTicketOrderPaid(order.id), 5000);
    return { payment_url: payment.paymentUrl, order_id: order.id };
  }

  async markRentalPaid(orderId: string) {
    const order = await this.prisma.rentalOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== RentalStatus.PENDING) return order;
    if (order.type === OrderType.BUY) {
      const paid = await this.prisma.rentalOrder.update({ where: { id: orderId }, data: { status: RentalStatus.PAID } });
      this.realtime.emitTicketVerified(order.userId, { type: "product:paid", order_id: orderId });
      return paid;
    }
    const paid = await this.prisma.rentalOrder.update({
      where: { id: orderId },
      data: {
        status: RentalStatus.ACTIVE,
        gateIds: Array.from({ length: order.quantity }, (_, index) => `gate-${order.id.slice(0, 5)}-${index + 1}`)
      }
    });
    this.realtime.emitTicketVerified(order.userId, { type: "rental:active", order_id: orderId });
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
    const payment = this.payos.createPaymentLink({ orderId: order.id, amount: total, kind: "api" });
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
      const paid = await tx.apiRentalOrder.update({
        where: { id: orderId },
        data: { status: RentalStatus.ACTIVE }
      });
      const issued = await this.keys.issueKey({
        userId: order.userId,
        rentalId: order.id,
        scopes: (Array.isArray(order.scopes) ? order.scopes : FULL_API_KEY_SCOPES) as never[],
        quota: order.quota,
        source: "self",
        tx
      });
      return { paid, issued };
    });
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
    const qrJwt = await this.auth.signJwt({
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
    const updated = await this.prisma.ticketOrder.update({ where: { id: orderId }, data: { status: TicketOrderStatus.PAID } });
    const tickets = [];
    const tenantId = order.show.ownerId;
    const offlineCapable = await isOfflineCapable(this.prisma, tenantId);
    for (let i = 0; i < order.quantity; i += 1) {
      const jti = crypto.randomBytes(18).toString("hex");
      const qrJwt = await this.auth.signJwt({ sub: `ticket:${order.id}:${i + 1}`, show_id: order.showId, buyer: order.buyerEmail, type: "ticket", jti }, 60 * 60 * 24 * 30);
      const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000);
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
      tickets.push(await this.prisma.ticket.create({ data: { showId: order.showId, ticketOrderId: order.id, jti, qrJwt, qrOfflineJwt } }));
    }
    const soldTickets = order.show.soldTickets + order.quantity;
    await this.prisma.show.update({ where: { id: order.showId }, data: { soldTickets } });
    await this.prisma.payout.create({
      data: { showOwnerId: order.show.ownerId, ticketOrderId: order.id, amount: order.payoutAmount }
    });
    await this.redis.del(`cache:show:${order.show.slug}`);
    this.realtime.emitTicketSold(order.showId, { order_id: orderId, quantity: order.quantity, sold_tickets: soldTickets, payout_amount: order.payoutAmount });
    return { ...updated, tickets };
  }

  async webhook(orderId: string, kind?: "rental" | "ticket" | "api") {
    if (kind === "rental") return this.markRentalPaid(orderId);
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
      if (key && external.userId !== key.userId) throw new UnauthorizedException("API key cannot verify this QR code");
      if (await this.redis.get(`gate:used:${external.apiKey.rentalId ?? external.userId}:${external.jti}`)) {
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
    const decoded = await this.auth.verifyJwt<{ jti: string; show_id?: string; buyer?: string; type?: string; owner_id?: string; resource_type?: string; resource_id?: string; customer_ref?: string }>(ticketToken);
    if (decoded.type === "external_qr") {
      const external = await this.prisma.externalQrCode.findFirst({ where: { qrJwt: ticketToken }, include: { apiKey: true } });
      if (!external || external.jti !== decoded.jti) throw new UnauthorizedException("QR code not found");
      if (key && external.userId !== key.userId) throw new UnauthorizedException("API key cannot verify this QR code");
      const externalGateUsedKey = `gate:used:${external.apiKey.rentalId ?? external.userId}:${decoded.jti}`;
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
    const ticketGateUsedKey = `gate:used:${ticket.show.ownerId}:${decoded.jti}`;
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

  async dashboard(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException("User not found");
    const [rentals, apiRentals, shows, apiKeys, ticketOrders, purchasedTicketOrders, payouts, tickets, externalQrCodes] = await Promise.all([
      this.prisma.rentalOrder.findMany({ where: { userId }, include: { product: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.apiRentalOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      this.prisma.show.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" } }),
      this.prisma.apiKey.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      this.prisma.ticketOrder.findMany({ where: { show: { ownerId: userId } }, include: { show: true, tickets: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.ticketOrder.findMany({ where: { buyerEmail: user.email }, include: { show: true, tickets: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.payout.findMany({ where: { showOwnerId: userId }, orderBy: { createdAt: "desc" } }),
      this.prisma.ticket.findMany({ where: { show: { ownerId: userId } }, include: { show: true }, orderBy: { createdAt: "desc" }, take: 20 }),
      this.prisma.externalQrCode.findMany({
        where: { userId },
        include: { scanLogs: { orderBy: { createdAt: "desc" }, take: 3 } },
        orderBy: { createdAt: "desc" },
        take: 20
      })
    ]);
    return { rentals, apiRentals: apiRentals.map(order => ({ ...order, signingSecret: undefined, webhookSecret: undefined })), shows, apiKeys: apiKeys.map(key => this.publicApiKey(key)), ticketOrders, purchasedTicketOrders, payouts, tickets, externalQrCodes };
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

  private publicApiKey(key: { id: string; userId: string; prefix: string; quota: number; scopes: unknown; rentalId?: string | null; status?: string; isTest?: boolean; allowedIps?: unknown; rateLimit?: number; revokeAt?: Date | null; createdAt: Date }) {
    return {
      id: key.id,
      userId: key.userId,
      prefix: key.prefix,
      quota: key.quota,
      scopes: Array.isArray(key.scopes) ? key.scopes : FULL_API_KEY_SCOPES,
      rentalId: key.rentalId ?? null,
      status: key.status ?? "active",
      isTest: key.isTest ?? false,
      allowedIps: Array.isArray(key.allowedIps) ? key.allowedIps : [],
      rateLimit: key.rateLimit ?? 60,
      revokeAt: key.revokeAt ?? null,
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

  private publicUser(user: { id: string; email: string; role: string }) {
    return { id: user.id, email: user.email, role: user.role };
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
