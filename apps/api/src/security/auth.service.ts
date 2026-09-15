import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { RedisService } from "../services/redis.service";
import { PrismaService } from "../services/prisma.service";
import { ApiKeyScope } from "./api-key.decorator";
import { assertActiveKey } from "./api-security";

export const FULL_API_KEY_SCOPES: ApiKeyScope[] = ["qr:create", "qr:read", "ticket:verify"];

@Injectable()
export class AuthService {
  private readonly jwt = new JwtService({ secret: process.env.JWT_SECRET ?? "dev-secret" });

  constructor(private readonly redis: RedisService, private readonly prisma: PrismaService) {}

  hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  hashApiKey(apiKey: string) {
    return crypto.createHash("sha256").update(apiKey).digest("hex");
  }

  async validateApiKey(apiKey: string) {
    try {
      const key = await this.getApiKey(apiKey);
      return Boolean(key);
    } catch {
      return false;
    }
  }

  async getApiKey(apiKey: string) {
    const hash = this.hashApiKey(apiKey);
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: hash }, include: { rental: true } });
    if (key) assertActiveKey(key);
    return key;
  }

  apiKeyHasScope(scopes: unknown, scope: ApiKeyScope) {
    if (!Array.isArray(scopes)) return true;
    return scopes.includes(scope);
  }

  async sessionFromAuthorization(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    try {
      return await this.verifyJwt<{ sub: string; email: string; role: string; jti: string }>(token);
    } catch {
      return null;
    }
  }

  async revokeJwt(token: string) {
    const decoded = this.jwt.verify<{ jti: string }>(token);
    await this.redis.del(`jwt:jti:${decoded.jti}`);
    return { revoked: true };
  }

  decodeJwt<T extends { jti: string }>(token: string): T {
    return this.jwt.verify<T>(token);
  }

  createApiKey(mode: "live" | "test" | "demo" = "live") {
    const raw = `sk_${mode}_${crypto.randomBytes(24).toString("hex")}`;
    return { raw, prefix: raw.slice(0, 20), hash: this.hashApiKey(raw) };
  }

  async signJwt(payload: Record<string, unknown>, ttlSeconds = 60 * 60 * 6) {
    const jti = typeof payload.jti === "string" ? payload.jti : crypto.randomBytes(18).toString("hex");
    const token = this.jwt.sign({ ...payload, jti }, { expiresIn: ttlSeconds });
    await this.redis.set(`jwt:jti:${jti}`, "active", ttlSeconds);
    return token;
  }

  async verifyJwt<T extends { jti: string }>(token: string): Promise<T> {
    try {
      const decoded = this.jwt.verify<T>(token);
      const active = await this.redis.get(`jwt:jti:${decoded.jti}`);
      if (!active) throw new UnauthorizedException("JWT jti is revoked or expired");
      return decoded;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
