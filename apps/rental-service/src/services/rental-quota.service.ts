import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Injectable()
export class RentalQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async consume(rentalId: string, amount: number) {
    this.assertAmount(amount);
    return this.prisma.$transaction(async tx => {
      const rental = await tx.apiRentalOrder.findUnique({ where: { id: rentalId } });
      if (!rental || rental.status !== "ACTIVE") {
        throw new ConflictException({ error: "rental_not_active", message: "API rental is not active" });
      }
      const month = new Date().toISOString().slice(0, 7);
      const period = await tx.apiUsagePeriod.upsert({
        where: { scopeId_month_isTest: { scopeId: rental.id, month, isTest: false } },
        create: { scopeId: rental.id, month, isTest: false },
        update: {}
      });
      const locked = await tx.$queryRaw<Array<{ qr_created: number }>>`
        SELECT qr_created FROM api_usage_periods WHERE id = ${period.id} FOR UPDATE
      `;
      const used = Number(locked[0]?.qr_created ?? 0);
      if (used + amount > rental.quota) {
        throw new ConflictException({ error: "quota_exceeded", message: "Rental has reached its quota limit" });
      }
      await tx.apiUsagePeriod.update({ where: { id: period.id }, data: { qrCreated: { increment: amount } } });
      return { success: true, quota_remaining: rental.quota - used - amount };
    });
  }

  async refund(rentalId: string, amount: number) {
    this.assertAmount(amount);
    return this.prisma.$transaction(async tx => {
      const month = new Date().toISOString().slice(0, 7);
      const period = await tx.apiUsagePeriod.findUnique({ where: { scopeId_month_isTest: { scopeId: rentalId, month, isTest: false } } });
      if (!period) return { success: true, quota_refunded: amount };
      await tx.$executeRaw`SELECT id FROM api_usage_periods WHERE id = ${period.id} FOR UPDATE`;
      const refunded = Math.max(0, period.qrCreated - amount);
      await tx.apiUsagePeriod.update({ where: { id: period.id }, data: { qrCreated: refunded } });
      return { success: true, quota_refunded: period.qrCreated - refunded };
    });
  }

  private assertAmount(amount: number) {
    if (!Number.isInteger(amount) || amount < 1 || amount > 500) {
      throw new BadRequestException({ error: "invalid_quota_amount", message: "amount must be an integer between 1 and 500" });
    }
  }
}
