import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

export type ApiPlanName = "starter" | "business";
export type ApiPlatformSettings = {
  commission_rate_bp: number;
  quota_warning_thresholds: number[];
  quota_burst: { window_minutes: number; threshold_percent: number; enabled: boolean };
  feature_flags: Record<string, boolean>;
  plan_limits: Record<ApiPlanName, { max_keys: number; quota: number; rate_limit: number; price: number }>;
};

export const DEFAULT_API_PLATFORM_SETTINGS: ApiPlatformSettings = {
  commission_rate_bp: 1000,
  quota_warning_thresholds: [80, 95],
  quota_burst: { window_minutes: 15, threshold_percent: 10, enabled: true },
  feature_flags: { api_explorer: true, bulk_create: true, pay_as_you_go: true },
  plan_limits: {
    starter: { max_keys: 2, quota: 5000, rate_limit: 60, price: 199000 },
    business: { max_keys: 10, quota: 30000, rate_limit: 600, price: 499000 }
  }
};

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async apiPlatform(): Promise<ApiPlatformSettings> {
    const row = await this.prisma.systemSetting.upsert({
      where: { key: "api_platform" },
      update: {},
      create: { key: "api_platform", value: DEFAULT_API_PLATFORM_SETTINGS as Prisma.InputJsonValue }
    });
    return this.merge(row.value);
  }

  async updateApiPlatform(value: { commission_rate_bp?: number; quota_warning_thresholds?: number[]; quota_burst?: { window_minutes?: number; threshold_percent?: number; enabled?: boolean }; feature_flags?: Record<string, boolean>; plan_limits?: Record<string, { max_keys?: number; quota?: number; rate_limit?: number; price?: number }> }, updatedBy: string) {
    if (value.quota_burst) {
      const { window_minutes, threshold_percent } = value.quota_burst;
      if (window_minutes !== undefined && (!Number.isInteger(window_minutes) || window_minutes < 1 || window_minutes > 1440)) {
        throw new BadRequestException({ error: "invalid_quota_burst_window", message: "quota_burst.window_minutes must be an integer between 1 and 1440" });
      }
      if (threshold_percent !== undefined && (!Number.isInteger(threshold_percent) || threshold_percent < 1 || threshold_percent > 100)) {
        throw new BadRequestException({ error: "invalid_quota_burst_threshold", message: "quota_burst.threshold_percent must be an integer between 1 and 100" });
      }
    }
    const current = await this.apiPlatform();
    const next = this.merge({ ...current, ...value, plan_limits: { ...current.plan_limits, ...(value.plan_limits ?? {}) }, feature_flags: { ...current.feature_flags, ...(value.feature_flags ?? {}) } });
    const updated = await this.prisma.systemSetting.upsert({
      where: { key: "api_platform" },
      create: { key: "api_platform", value: next as Prisma.InputJsonValue, updatedBy },
      update: { value: next as Prisma.InputJsonValue, updatedBy, version: { increment: 1 } }
    });
    return { before: current, after: this.merge(updated.value), version: updated.version };
  }

  private merge(raw: unknown): ApiPlatformSettings {
    const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const planLimits = source.plan_limits && typeof source.plan_limits === "object" ? source.plan_limits as Record<string, unknown> : {};
    const normalizePlan = (name: ApiPlanName) => ({
      ...DEFAULT_API_PLATFORM_SETTINGS.plan_limits[name],
      ...(planLimits[name] && typeof planLimits[name] === "object" ? planLimits[name] as object : {})
    });
    const commission = Number(source.commission_rate_bp ?? DEFAULT_API_PLATFORM_SETTINGS.commission_rate_bp);
    const thresholds = Array.isArray(source.quota_warning_thresholds) ? source.quota_warning_thresholds.map(Number).filter(Number.isFinite) : DEFAULT_API_PLATFORM_SETTINGS.quota_warning_thresholds;
    const burst = source.quota_burst && typeof source.quota_burst === "object" ? source.quota_burst as Record<string, unknown> : {};
    const envWindow = Number(process.env.API_QUOTA_BURST_WINDOW_MINUTES);
    const envThreshold = Number(process.env.API_QUOTA_BURST_PERCENT);
    const windowMinutes = Number(burst.window_minutes ?? (Number.isInteger(envWindow) && envWindow >= 1 && envWindow <= 1440 ? envWindow : DEFAULT_API_PLATFORM_SETTINGS.quota_burst.window_minutes));
    const thresholdPercent = Number(burst.threshold_percent ?? (Number.isInteger(envThreshold) && envThreshold >= 1 && envThreshold <= 100 ? envThreshold : DEFAULT_API_PLATFORM_SETTINGS.quota_burst.threshold_percent));
    return {
      commission_rate_bp: Math.min(5000, Math.max(0, Number.isFinite(commission) ? commission : DEFAULT_API_PLATFORM_SETTINGS.commission_rate_bp)),
      quota_warning_thresholds: thresholds.length ? thresholds : DEFAULT_API_PLATFORM_SETTINGS.quota_warning_thresholds,
      quota_burst: {
        window_minutes: Number.isInteger(windowMinutes) && windowMinutes >= 1 && windowMinutes <= 1440 ? windowMinutes : DEFAULT_API_PLATFORM_SETTINGS.quota_burst.window_minutes,
        threshold_percent: Number.isInteger(thresholdPercent) && thresholdPercent >= 1 && thresholdPercent <= 100 ? thresholdPercent : DEFAULT_API_PLATFORM_SETTINGS.quota_burst.threshold_percent,
        enabled: typeof burst.enabled === "boolean" ? burst.enabled : DEFAULT_API_PLATFORM_SETTINGS.quota_burst.enabled
      },
      feature_flags: { ...DEFAULT_API_PLATFORM_SETTINGS.feature_flags, ...(source.feature_flags && typeof source.feature_flags === "object" ? source.feature_flags as Record<string, boolean> : {}) },
      plan_limits: { starter: normalizePlan("starter"), business: normalizePlan("business") }
    };
  }
}
