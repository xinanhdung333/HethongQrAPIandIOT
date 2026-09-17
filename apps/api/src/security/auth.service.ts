import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { RedisService } from "../services/redis.service";
import { PrismaService } from "../services/prisma.service";
import { ApiKeyScope } from "./api-key.decorator";
import { assertActiveKey } from "./api-security";

export const FULL_API_KEY_SCOPES: ApiKeyScope[] = ["qr:create", "qr:read", "ticket:verify"];

@Injectable()
export class AuthService {
  private readonly jwt = new JwtService({ secret: process.env.JWT_SECRET ?? "dev-secret" });
  private readonly qrSecret = process.env.QR_JWT_SECRET ?? process.env.JWT_SECRET ?? "dev-secret";
  private readonly legacyQrSecret = process.env.JWT_SECRET ?? "dev-secret";
  private readonly qrLegacyFallbackUntil = Date.now() +
    Math.max(0, Number(process.env.QR_JWT_LEGACY_FALLBACK_DAYS ?? 30)) * 24 * 60 * 60 * 1000;

  constructor(private readonly redis: RedisService, private readonly prisma: PrismaService) {}

  hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  hashApiKey(apiKey: string) {
    return crypto.createHmac("sha256", this.apiKeyPepper()).update(apiKey).digest("hex");
  }

  private legacyHashApiKey(apiKey: string) {
    return crypto.createHash("sha256").update(apiKey).digest("hex");
  }

  private apiKeyPepper() {
    const pepper = process.env.API_KEY_PEPPER;
    if (!pepper && process.env.NODE_ENV === "production") throw new Error("API_KEY_PEPPER is required in production");
    return pepper ?? "local-development-api-key-pepper";
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
    let key = await this.prisma.apiKey.findUnique({ where: { keyHash: hash }, include: { rental: true } });
    if (!key) {
      const legacyHash = this.legacyHashApiKey(apiKey);
      key = await this.prisma.apiKey.findUnique({ where: { keyHash: legacyHash }, include: { rental: true } });
      if (key) await this.prisma.apiKey.update({ where: { id: key.id }, data: { keyHash: hash } });
    }
    if (key) {
      if (key.status === "suspended" && key.suspendUntil && key.suspendUntil <= new Date()) {
        key = await this.prisma.apiKey.update({ where: { id: key.id }, data: { status: "active", suspendUntil: null }, include: { rental: true } });
      }
      assertActiveKey(key);
    }
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
    const raw = `sq_${mode}_${crypto.randomBytes(24).toString("hex")}`;
    return { raw, prefix: raw.slice(0, 20), hash: this.hashApiKey(raw) };
  }

  async signJwt(payload: Record<string, unknown>, ttlSeconds = 60 * 60 * 6) {
    const jti = typeof payload.jti === "string" ? payload.jti : crypto.randomBytes(18).toString("hex");
    const token = this.jwt.sign({ ...payload, jti }, { expiresIn: ttlSeconds });
    await this.redis.set(`jwt:jti:${jti}`, "active", ttlSeconds);
    return token;
  }

  async signQrJwt(payload: Record<string, unknown>, ttlSeconds = 60 * 60 * 24 * 30) {
    return this.signWithSecret(this.qrSecret, payload, ttlSeconds);
  }

  async verifyQrJwt<T extends { jti: string }>(token: string): Promise<T> {
    try {
      return await this.verifyWithSecret<T>(token, this.qrSecret);
    } catch (primaryError) {
      if (this.legacyQrSecret === this.qrSecret || Date.now() > this.qrLegacyFallbackUntil) throw primaryError;
      const decoded = jwt.verify(token, this.legacyQrSecret) as T & { iat?: number };
      const hour = new Date().toISOString().slice(0, 13);
      const warningKey = `qr:legacy-fallback:${decoded.jti}:${hour}`;
      if (!(await this.redis.get(warningKey))) {
        await this.redis.set(warningKey, "logged", 60 * 60);
        console.warn("QR JWT verified with legacy JWT_SECRET during secret rollover");
      }
      return this.assertActiveJti(decoded);
    }
  }

  async verifyJwt<T extends { jti: string }>(token: string): Promise<T> {
    return this.verifyWithSecret(token, process.env.JWT_SECRET ?? "dev-secret");
  }

  private async verifyWithSecret<T extends { jti: string }>(token: string, secret: string): Promise<T> {
    try {
      const decoded = jwt.verify(token, secret) as T;
      return this.assertActiveJti(decoded);
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }

  private async assertActiveJti<T extends { jti: string }>(decoded: T) {
    const active = await this.redis.get(`jwt:jti:${decoded.jti}`);
    if (!active) throw new UnauthorizedException("JWT jti is revoked or expired");
    return decoded;
  }

  private signWithSecret(secret: string, payload: Record<string, unknown>, ttlSeconds: number) {
    const jti = typeof payload.jti === "string" ? payload.jti : crypto.randomBytes(18).toString("hex");
    const token = jwt.sign({ ...payload, jti }, secret, { expiresIn: ttlSeconds });
    return this.redis.set(`jwt:jti:${jti}`, "active", ttlSeconds).then(() => token);
  }
}
