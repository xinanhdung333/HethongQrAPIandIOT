import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ApiKey, ApiRentalOrder, PaymentTransactionStatus, Prisma } from "@prisma/client";
import { PaymentCreateDto, PaymentQueryDto, PaymentStatusDto } from "../settings-payment.dto";
import { AuthService } from "../security/auth.service";
import { PrismaService } from "./prisma.service";
import { SystemSettingsService } from "./system-settings.service";

type IntegrationKey = ApiKey & { rental: ApiRentalOrder | null };
type Session = { sub: string; email: string; role: string; jti: string };

@Injectable()
export class PaymentTransactionsService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly settings: SystemSettingsService) {}

  async create(dto: PaymentCreateDto, rawApiKey?: string, idempotencyKey?: string) {
    if (!idempotencyKey) throw new BadRequestException({ error: "missing_idempotency_key", message: "Idempotency-Key header is required" });
    if (!/^[\x21-\x7E]{1,200}$/.test(idempotencyKey)) throw new BadRequestException({ error: "invalid_idempotency_key", message: "Idempotency-Key must contain 1-200 printable characters without spaces" });
    const key = await this.requireKey(rawApiKey);
    if (!dto.qr_code_id && !dto.rental_id) throw new BadRequestException({ error: "missing_payment_target", message: "qr_code_id or rental_id is required" });
    if (Buffer.byteLength(JSON.stringify(dto.metadata ?? {}), "utf8") > 4096) throw new BadRequestException({ error: "metadata_too_large", message: "metadata must not exceed 4 KiB" });

    const prior = await this.prisma.paymentTransaction.findUnique({ where: { idempotencyKey } });
    if (prior) return { payment: this.publicPayment(prior), idempotent: true };

    const platform = await this.settings.apiPlatform();
    if (platform.feature_flags.pay_as_you_go === false) throw new ForbiddenException({ error: "feature_disabled", message: "Payment split and pay-as-you-go payment API are disabled by admin settings" });
    return this.prisma.$transaction(async tx => {
      let rental = key.rental;
      let qrCodeId: string | null = null;
      if (dto.qr_code_id) {
        const qr = await tx.externalQrCode.findUnique({ where: { id: dto.qr_code_id }, include: { apiKey: { include: { rental: true } } } });
        if (!qr || qr.userId !== key.userId || qr.isTest !== key.isTest) throw new NotFoundException({ error: "qr_not_found", message: "QR code not found" });
        if (key.rentalId && qr.apiKey.rentalId !== key.rentalId) throw new ForbiddenException({ error: "forbidden_payment_target", message: "API key cannot create payment for this QR code" });
        rental = qr.apiKey.rental;
        qrCodeId = qr.id;
      } else if (dto.rental_id) {
        if (!key.rentalId || key.rentalId !== dto.rental_id) throw new ForbiddenException({ error: "forbidden_payment_target", message: "API key cannot create payment for this rental" });
      }
      if (!rental) throw new BadRequestException({ error: "missing_rental", message: "Payment API requires an API key attached to a rental" });
      const commissionRateBp = rental.commissionRateOverrideBp ?? platform.commission_rate_bp;
      const commissionAmount = Math.floor(dto.gross_amount * commissionRateBp / 10000);
      const userAmount = dto.gross_amount - commissionAmount;
      const payout = await tx.payoutAccount.findFirst({ where: { userId: rental.userId, status: "active", isDefault: true } })
        ?? await tx.payoutAccount.findFirst({ where: { userId: rental.userId, status: "active" }, orderBy: { createdAt: "asc" } });
      const snapshot = payout ? {
        id: payout.id,
        method: payout.method,
        bank_name: payout.bankName,
        account_number: payout.accountNumber,
        account_name: payout.accountName,
        wallet_type: payout.walletType,
        wallet_id: payout.walletId,
        captured_at: new Date().toISOString()
      } : null;
      try {
        const payment = await tx.paymentTransaction.create({ data: { userId: rental.userId, rentalId: rental.id, qrCodeId, idempotencyKey, grossAmount: dto.gross_amount, commissionRateBp, commissionAmount, userAmount, payoutAccountId: payout?.id ?? null, payoutAccountSnapshot: snapshot as Prisma.InputJsonValue, status: PaymentTransactionStatus.PAYOUT_PROCESSING, confirmedAt: new Date(), metadata: dto.metadata ? this.json(dto.metadata) : Prisma.JsonNull } });
        return { payment: this.publicPayment(payment), idempotent: false };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const duplicate = await tx.paymentTransaction.findUniqueOrThrow({ where: { idempotencyKey } });
          return { payment: this.publicPayment(duplicate), idempotent: true };
        }
        throw error;
      }
    });
  }

  async developerPayments(userId: string, query: PaymentQueryDto) {
    return this.list({ userId }, query, false);
  }

  async adminPayments(query: PaymentQueryDto) {
    return this.list({}, query, true);
  }

  async updateStatus(session: Session, id: string, dto: PaymentStatusDto) {
    if (session.role !== "ADMIN") throw new ForbiddenException({ error: "admin_required", message: "Admin role required" });
    const status = dto.status as PaymentTransactionStatus;
    const payment = await this.prisma.paymentTransaction.update({
      where: { id },
      data: { status, payoutNote: dto.note ?? undefined, payoutCompletedAt: status === PaymentTransactionStatus.PAYOUT_COMPLETED ? new Date() : undefined }
    });
    return { payment: this.publicPayment(payment) };
  }

  publicPayment(payment: { id: string; rentalId: string; qrCodeId: string | null; grossAmount: number; commissionRateBp: number; commissionAmount: number; userAmount: number; payoutAccountId: string | null; payoutAccountSnapshot: unknown; metadata?: unknown; status: PaymentTransactionStatus; createdAt: Date; confirmedAt: Date | null; payoutCompletedAt: Date | null; updatedAt: Date }) {
    return {
      id: payment.id,
      rental_id: payment.rentalId,
      qr_code_id: payment.qrCodeId,
      gross_amount: payment.grossAmount,
      commission_rate_bp: payment.commissionRateBp,
      commission_amount: payment.commissionAmount,
      user_amount: payment.userAmount,
      payout_account_id: payment.payoutAccountId,
      payout_account_snapshot: this.maskSnapshot(payment.payoutAccountSnapshot),
      metadata: payment.metadata ?? null,
      status: payment.status,
      created_at: payment.createdAt.toISOString(),
      confirmed_at: payment.confirmedAt?.toISOString() ?? null,
      payout_completed_at: payment.payoutCompletedAt?.toISOString() ?? null,
      updated_at: payment.updatedAt.toISOString()
    };
  }

  private async list(baseWhere: Prisma.PaymentTransactionWhereInput, query: PaymentQueryDto, includeSummary: boolean) {
    const page = Math.max(1, Number(query.page || 1));
    const where: Prisma.PaymentTransactionWhereInput = { ...baseWhere };
    if (query.rental_id) where.rentalId = query.rental_id;
    if (query.status) where.status = query.status as PaymentTransactionStatus;
    if (query.from || query.to) where.createdAt = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) };
    const [items, total, summary] = await Promise.all([
      this.prisma.paymentTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { rental: { select: { appName: true } }, user: { select: { email: true, avatarUrl: true } } } }),
      this.prisma.paymentTransaction.count({ where }),
      includeSummary ? this.prisma.paymentTransaction.aggregate({ where, _sum: { grossAmount: true, commissionAmount: true, userAmount: true } }) : Promise.resolve(null)
    ]);
    return { items: items.map(item => ({ ...this.publicPayment(item), rental_app_name: item.rental.appName, user_email: item.user.email, user_avatar_url: item.user.avatarUrl })), total, page, summary: summary ? { gross_amount: summary._sum.grossAmount ?? 0, commission_amount: summary._sum.commissionAmount ?? 0, user_amount: summary._sum.userAmount ?? 0 } : undefined };
  }

  private async requireKey(raw?: string): Promise<IntegrationKey> {
    if (!raw) throw new UnauthorizedException({ error: "missing_api_key", message: "Missing API key" });
    const key = await this.auth.getApiKey(raw);
    if (!key) throw new UnauthorizedException({ error: "invalid_api_key", message: "Invalid or expired API key" });
    if (!this.auth.apiKeyHasScope(key.scopes, "ticket:verify")) throw new ForbiddenException({ error: "forbidden_scope", message: "API key does not have 'ticket:verify' permission" });
    return key as IntegrationKey;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private maskSnapshot(value: unknown) {
    if (!value || typeof value !== "object") return value;
    const snapshot = { ...(value as Record<string, unknown>) };
    for (const field of ["account_number", "wallet_id"]) {
      if (typeof snapshot[field] === "string") snapshot[field] = this.mask(String(snapshot[field]));
    }
    return snapshot;
  }

  private mask(value: string) {
    if (value.length <= 4) return "****";
    return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
  }
}
