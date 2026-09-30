import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PayoutMethod } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { AuthService } from "../security/auth.service";
import { AvatarUploadDto, PayoutAccountDto } from "../settings-payment.dto";
import { ActivityLogService } from "./activity-log.service";
import { PrismaService } from "./prisma.service";

const AVATAR_DIR = path.resolve(process.cwd(), "../web/public/uploads/avatars");
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

type Session = { sub: string; email: string; role: string; jti: string };

@Injectable()
export class AccountSettingsService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly activity: ActivityLogService) {}

  async profile(session: Session) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: session.sub }, select: { id: true, email: true, role: true, avatarUrl: true, payoutAccounts: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] } } });
    return { ...user, payoutAccounts: user.payoutAccounts.map(account => this.maskAccount(account)) };
  }

  async uploadAvatar(session: Session, dto: AvatarUploadDto) {
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dto.avatar_data_url || "");
    if (!match) throw new BadRequestException({ error: "invalid_avatar", message: "Avatar must be a png, jpg or webp data URL" });
    const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    if (!buffer.length || buffer.length > MAX_AVATAR_BYTES) throw new BadRequestException({ error: "avatar_too_large", message: "Avatar must be 2MB or smaller" });
    let optimized: Buffer;
    try {
      optimized = await sharp(buffer, { failOn: "error" })
        .rotate()
        .resize(256, 256, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException({ error: "invalid_avatar", message: "Avatar image cannot be decoded" });
    }
    await fs.mkdir(AVATAR_DIR, { recursive: true });
    const hash = createHash("sha256").update(optimized).digest("hex").slice(0, 16);
    const fileName = `${session.sub}-${hash}.webp`;
    await fs.writeFile(path.join(AVATAR_DIR, fileName), optimized);
    const avatarUrl = `/uploads/avatars/${fileName}`;
    await this.prisma.user.update({ where: { id: session.sub }, data: { avatarUrl } });
    await this.activity.record({ session, action: "UPDATE_AVATAR", targetType: "User", targetId: session.sub, metadata: { avatar_url: avatarUrl } });
    return { avatar_url: avatarUrl };
  }

  async createPayoutAccount(session: Session, dto: PayoutAccountDto) {
    this.validatePayout(dto);
    const account = await this.prisma.$transaction(async tx => {
      if (dto.is_default) await tx.payoutAccount.updateMany({ where: { userId: session.sub, status: "active" }, data: { isDefault: false } });
      const existing = await tx.payoutAccount.count({ where: { userId: session.sub, status: "active" } });
      return tx.payoutAccount.create({ data: { userId: session.sub, method: dto.method as PayoutMethod, bankName: dto.bank_name?.trim() || null, accountNumber: dto.account_number?.trim() || null, accountName: dto.account_name.trim(), branch: dto.branch?.trim() || null, walletType: dto.wallet_type?.trim() || null, walletId: dto.wallet_id?.trim() || null, isDefault: dto.is_default ?? existing === 0 } });
    });
    await this.activity.record({ session, action: "CREATE_PAYOUT_ACCOUNT", targetType: "PayoutAccount", targetId: account.id, metadata: { method: account.method, is_default: account.isDefault } });
    return { account: this.maskAccount(account) };
  }

  async updatePayoutAccount(session: Session, id: string, dto: Partial<PayoutAccountDto>) {
    const current = await this.accountForUser(session.sub, id);
    const data: Prisma.PayoutAccountUpdateInput = {};
    const merged = { method: dto.method ?? current.method, bank_name: dto.bank_name ?? current.bankName ?? undefined, account_number: dto.account_number ?? current.accountNumber ?? undefined, account_name: dto.account_name ?? current.accountName, wallet_type: dto.wallet_type ?? current.walletType ?? undefined, wallet_id: dto.wallet_id ?? current.walletId ?? undefined } as PayoutAccountDto;
    this.validatePayout(merged);
    if (dto.method) data.method = dto.method as PayoutMethod;
    if (dto.bank_name !== undefined) data.bankName = dto.bank_name.trim() || null;
    if (dto.account_number !== undefined) data.accountNumber = dto.account_number.trim() || null;
    if (dto.account_name !== undefined) data.accountName = dto.account_name.trim();
    if (dto.branch !== undefined) data.branch = dto.branch.trim() || null;
    if (dto.wallet_type !== undefined) data.walletType = dto.wallet_type.trim() || null;
    if (dto.wallet_id !== undefined) data.walletId = dto.wallet_id.trim() || null;
    const account = await this.prisma.$transaction(async tx => {
      if (dto.is_default) await tx.payoutAccount.updateMany({ where: { userId: session.sub, status: "active" }, data: { isDefault: false } });
      return tx.payoutAccount.update({ where: { id }, data: { ...data, ...(dto.is_default !== undefined ? { isDefault: dto.is_default } : {}) } });
    });
    await this.activity.record({ session, action: "UPDATE_PAYOUT_ACCOUNT", targetType: "PayoutAccount", targetId: id, metadata: { before: this.maskAccount(current), after: this.maskAccount(account) } as Prisma.InputJsonValue });
    return { account: this.maskAccount(account) };
  }

  async setDefault(session: Session, id: string) {
    await this.accountForUser(session.sub, id);
    const account = await this.prisma.$transaction(async tx => {
      await tx.payoutAccount.updateMany({ where: { userId: session.sub, status: "active" }, data: { isDefault: false } });
      return tx.payoutAccount.update({ where: { id }, data: { isDefault: true, status: "active" } });
    });
    await this.activity.record({ session, action: "SET_DEFAULT_PAYOUT_ACCOUNT", targetType: "PayoutAccount", targetId: id });
    return { account: this.maskAccount(account) };
  }

  async deletePayoutAccount(session: Session, id: string) {
    const account = await this.accountForUser(session.sub, id);
    const updated = await this.prisma.payoutAccount.update({ where: { id }, data: { status: "deleted", isDefault: false } });
    await this.activity.record({ session, action: "DELETE_PAYOUT_ACCOUNT", targetType: "PayoutAccount", targetId: id, metadata: this.maskAccount(account) as Prisma.InputJsonValue });
    return { account: this.maskAccount(updated) };
  }

  async revealPayoutAccount(session: Session, id: string, password?: string) {
    if (session.role !== "ADMIN") await this.requirePassword(session.sub, password);
    const account = session.role === "ADMIN"
      ? await this.prisma.payoutAccount.findUnique({ where: { id } })
      : await this.accountForUser(session.sub, id);
    if (!account) throw new NotFoundException({ error: "payout_account_not_found", message: "Payout account not found" });
    await this.activity.record({ session, action: "REVEAL_PAYOUT_ACCOUNT", targetType: "PayoutAccount", targetId: id, metadata: { owner_id: account.userId } });
    return { account };
  }

  async requirePassword(userId: string, password?: string) {
    if (!password) throw new ForbiddenException({ error: "reauth_required", message: "Password is required to reveal or rotate sensitive data" });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await this.auth.comparePassword(password, user.passwordHash))) throw new ForbiddenException({ error: "reauth_failed", message: "Password is invalid" });
  }

  maskAccount(account: { id: string; userId: string; method: PayoutMethod; bankName: string | null; accountNumber: string | null; accountName: string; branch: string | null; walletType: string | null; walletId: string | null; isDefault: boolean; status: string; createdAt: Date; updatedAt: Date }) {
    const secret = account.method === "BANK" ? account.accountNumber : account.walletId;
    return { ...account, accountNumber: account.accountNumber ? this.mask(account.accountNumber) : null, walletId: account.walletId ? this.mask(account.walletId) : null, label: `${account.method === "BANK" ? account.bankName ?? "Bank" : account.walletType ?? "Wallet"} ${secret ? this.mask(secret) : ""}`.trim() };
  }

  private async accountForUser(userId: string, id: string) {
    const account = await this.prisma.payoutAccount.findFirst({ where: { id, userId, status: { not: "deleted" } } });
    if (!account) throw new NotFoundException({ error: "payout_account_not_found", message: "Payout account not found" });
    return account;
  }

  private validatePayout(dto: PayoutAccountDto) {
    if (dto.method === "BANK" && (!dto.bank_name?.trim() || !dto.account_number?.trim())) throw new BadRequestException({ error: "invalid_payout_account", message: "Bank payout requires bank_name and account_number" });
    if (dto.method === "WALLET" && (!dto.wallet_type?.trim() || !dto.wallet_id?.trim())) throw new BadRequestException({ error: "invalid_payout_account", message: "Wallet payout requires wallet_type and wallet_id" });
    if (!dto.account_name?.trim()) throw new BadRequestException({ error: "invalid_payout_account", message: "account_name is required" });
  }

  private mask(value: string) {
    if (value.length <= 4) return "****";
    return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
  }
}
