import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RentalStatus } from "@prisma/client";
import { ApiKeyScope } from "../security/api-key.decorator";
import { AuthService, FULL_API_KEY_SCOPES } from "../security/auth.service";
import { PrismaService } from "./prisma.service";
import { SystemSettingsService } from "./system-settings.service";

type IssueSource = "self" | "admin" | "developer" | "hardware_rental";
type IssueInput = {
  userId: string;
  rentalId?: string;
  showId?: string;
  scopes: ApiKeyScope[];
  quota?: number;
  mode?: "live" | "test";
  source: IssueSource;
  excludeKeyId?: string;
  tx?: Prisma.TransactionClient;
};

@Injectable()
export class ApiKeyIssuanceService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly settings: SystemSettingsService) {}

  async issueKey(input: IssueInput) {
    if (!input.rentalId && !input.showId) throw new BadRequestException({ error: "missing_scope_owner", message: "API key must be attached to an API rental or show" });
    const tx = input.tx ?? this.prisma;
    if (input.showId) {
      const show = await tx.show.findFirst({ where: { id: input.showId, ownerId: input.userId } });
      if (!show) throw new NotFoundException({ error: "show_not_found", message: "Show not found for this user" });
      const existing = await tx.apiKey.findFirst({ where: { showId: show.id, status: "active" } });
      if (existing) throw new ForbiddenException({ error: "show_scan_key_exists", message: "This show already has an active scanner key" });
      const keyCount = await tx.apiKey.count({ where: { showId: show.id, status: { in: ["active", "deprecated"] } } });
      if (keyCount >= 2) throw new ForbiddenException({ error: "show_scan_key_limit", message: "A show can have at most one active and one deprecated scanner key" });
      const raw = this.auth.createApiKey("live");
      const key = await tx.apiKey.create({
        data: {
          userId: input.userId,
          showId: show.id,
          keyHash: raw.hash,
          prefix: raw.prefix,
          quota: input.quota ?? 100000,
          scopes: Array.from(new Set(input.scopes)),
          rateLimit: 600,
          isTest: false,
          status: "active"
        }
      });
      return { api_key_once: raw.raw, key };
    }
    const rental = await tx.apiRentalOrder.findFirst({ where: { id: input.rentalId, userId: input.userId } });
    if (!rental) throw new NotFoundException({ error: "api_rental_not_found", message: "API rental not found for this user" });
    if (rental.status !== RentalStatus.ACTIVE) throw new ForbiddenException({ error: "rental_inactive", message: "API rental is not active" });

    const allowedScopes = Array.isArray(rental.scopes) ? rental.scopes.filter((scope): scope is ApiKeyScope => FULL_API_KEY_SCOPES.includes(scope as ApiKeyScope)) : FULL_API_KEY_SCOPES;
    const scopes = Array.from(new Set(input.scopes.filter(scope => allowedScopes.includes(scope))));
    if (!scopes.length) throw new BadRequestException({ error: "invalid_scopes", message: "API key must have at least one scope allowed by this rental" });

    const settings = await this.settings.apiPlatform();
    const plan = settings.plan_limits[rental.plan as "starter" | "business"] ?? settings.plan_limits.starter;
    const count = await tx.apiKey.count({
      where: {
        rentalId: rental.id,
        status: { in: ["active", "deprecated"] },
        ...(input.excludeKeyId ? { id: { not: input.excludeKeyId } } : {})
      }
    });
    if (count >= plan.max_keys) throw new ForbiddenException({ error: "api_key_limit_exceeded", message: `Plan allows at most ${plan.max_keys} active/deprecated API keys for this rental` });

    const raw = this.auth.createApiKey(input.mode ?? "live");
    const key = await tx.apiKey.create({
      data: {
        userId: rental.userId,
        rentalId: rental.id,
        keyHash: raw.hash,
        prefix: raw.prefix,
        quota: input.quota ?? rental.quota,
        scopes,
        rateLimit: plan.rate_limit,
        isTest: (input.mode ?? "live") === "test",
        status: "active"
      }
    });
    await tx.apiRentalOrder.update({ where: { id: rental.id }, data: { apiKeyPrefix: key.prefix } });
    return { api_key_once: raw.raw, key };
  }
}
