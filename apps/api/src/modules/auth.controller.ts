import { BadRequestException, Body, Controller, Get, Headers, Patch, Post, Query, Req, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { LoginDto, RegisterDto, UpdateProfileDto } from "../dto";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";

@Controller("auth")
export class AuthController {
  private readonly locationCache = new Map<string, { expiresAt: number; items: Array<{ code: string; name: string }> }>();

  constructor(private readonly platform: PlatformService, private readonly activity: ActivityLogService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.platform.register(dto);
    await this.activity.record({ session: { sub: result.user.id, email: result.user.email, role: result.user.role, jti: "" }, action: "REGISTER", targetType: "User", targetId: result.user.id, req });
    return result;
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.platform.login(dto);
    await this.activity.record({ session: { sub: result.user.id, email: result.user.email, role: result.user.role, jti: "" }, action: "LOGIN", targetType: "User", targetId: result.user.id, req });
    return result;
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Missing token");
    return this.platform.me(token);
  }

  @Get("locations/provinces")
  locationsProvinces() {
    return this.getLocations("provinces", "https://provinces.open-api.vn/api/v1/p/");
  }

  @Get("locations/districts")
  async locationsDistricts(@Query("provinceCode") provinceCode?: string) {
    this.assertLocationCode(provinceCode);
    const result = await this.getLocationTree(`province:${provinceCode}`, `https://provinces.open-api.vn/api/v1/p/${provinceCode}?depth=2`);
    return result.districts ?? [];
  }

  @Get("locations/wards")
  async locationsWards(@Query("districtCode") districtCode?: string) {
    this.assertLocationCode(districtCode);
    const result = await this.getLocationTree(`district:${districtCode}`, `https://provinces.open-api.vn/api/v1/d/${districtCode}?depth=2`);
    return result.wards ?? [];
  }

  @Patch("profile")
  async updateProfile(@Body() dto: UpdateProfileDto, @Headers("authorization") authorization?: string, @Req() req?: Request) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Missing token");
    const session = await this.platform.me(token).then((value) => ({ sub: value.user.id, email: value.user.email, role: value.user.role, jti: "" }));
    const result = await this.platform.updateProfile(session.sub, dto);
    await this.activity.record({ session, action: "UPDATE_PROFILE", targetType: "User", targetId: session.sub, metadata: { email_changed: Boolean(dto.email) }, req });
    return result;
  }

  @Post("logout")
  async logout(@Headers("authorization") authorization?: string, @Req() req?: Request) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Missing token");
    const session = await this.platform.me(token).then((value) => ({ sub: value.user.id, email: value.user.email, role: value.user.role, jti: "" }));
    const result = await this.platform.logout(token);
    await this.activity.record({ session, action: "LOGOUT", targetType: "User", targetId: session.sub, req });
    return result;
  }

  private assertLocationCode(code?: string): asserts code is string {
    if (!code || !/^\d{1,8}$/.test(code)) throw new BadRequestException("Ma dia gioi khong hop le");
  }

  private async getLocations(cacheKey: string, url: string) {
    const cached = this.locationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.items;
    const response = await this.fetchLocationApi(url);
    if (!Array.isArray(response)) throw new ServiceUnavailableException("Du lieu dia gioi khong hop le");
    const items = this.normalizeLocations(response);
    this.locationCache.set(cacheKey, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, items });
    return items;
  }

  private async getLocationTree(cacheKey: string, url: string) {
    const response = await this.fetchLocationApi(url) as { districts?: unknown[]; wards?: unknown[] };
    return {
      districts: this.normalizeLocations(response.districts ?? []),
      wards: this.normalizeLocations(response.wards ?? [])
    };
  }

  private async fetchLocationApi(url: string): Promise<unknown> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Location API ${response.status}`);
      return response.json();
    } catch {
      throw new ServiceUnavailableException("Tam thoi khong tai duoc danh sach dia gioi");
    }
  }

  private normalizeLocations(items: unknown[]) {
    return items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as { code?: string | number; name?: string };
      return value.code !== undefined && typeof value.name === "string" ? [{ code: String(value.code), name: value.name }] : [];
    });
  }
}
