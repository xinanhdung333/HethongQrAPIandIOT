"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.FULL_API_KEY_SCOPES = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_service_1 = require("../services/redis.service");
const prisma_service_1 = require("../services/prisma.service");
const api_security_1 = require("./api-security");
const build_timestamp_1 = require("../generated/build-timestamp");
exports.FULL_API_KEY_SCOPES = ["qr:create", "qr:read", "ticket:verify"];
const moduleImportedAt = Date.now();
function rolloverUntil(name, legacyDaysName) {
    const configured = process.env[name];
    if (configured)
        return new Date(configured).getTime();
    const buildTimestamp = process.env.BUILD_TIMESTAMP ?? build_timestamp_1.BUILD_TIMESTAMP;
    const base = buildTimestamp ? new Date(buildTimestamp).getTime() : moduleImportedAt;
    const days = Math.max(0, Number(process.env[legacyDaysName] ?? 30));
    return base + days * 24 * 60 * 60 * 1000;
}
let AuthService = AuthService_1 = class AuthService {
    redis;
    prisma;
    logger = new common_1.Logger(AuthService_1.name);
    jwt = new jwt_1.JwtService({ secret: process.env.JWT_SECRET ?? "dev-secret" });
    qrSecret = process.env.QR_JWT_SECRET ?? process.env.JWT_SECRET ?? "dev-secret";
    legacyQrSecret = process.env.JWT_SECRET ?? "dev-secret";
    qrLegacyFallbackUntil = rolloverUntil("QR_JWT_LEGACY_FALLBACK_UNTIL", "QR_JWT_LEGACY_FALLBACK_DAYS");
    apiKeyPepperRolloverUntil = rolloverUntil("API_KEY_PEPPER_ROLLOVER_UNTIL", "API_KEY_PEPPER_ROLLOVER_DAYS");
    legacySha256Until = process.env.API_KEY_LEGACY_SHA256_UNTIL
        ? new Date(process.env.API_KEY_LEGACY_SHA256_UNTIL).getTime()
        : Number.POSITIVE_INFINITY;
    constructor(redis, prisma) {
        this.redis = redis;
        this.prisma = prisma;
        if (!process.env.QR_JWT_LEGACY_FALLBACK_UNTIL || !process.env.API_KEY_PEPPER_ROLLOVER_UNTIL) {
            this.logger.warn("Legacy rollover dates are not absolute; configure *_UNTIL to avoid reset on redeploy.");
        }
    }
    hashPassword(password) {
        return bcryptjs_1.default.hash(password, 12);
    }
    comparePassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    hashApiKey(apiKey) {
        return this.hashApiKeyWithPepper(apiKey, this.apiKeyPepper());
    }
    hashApiKeyWithPepper(apiKey, pepper) {
        return crypto_1.default.createHmac("sha256", pepper).update(apiKey).digest("hex");
    }
    legacyHashApiKey(apiKey) {
        return crypto_1.default.createHash("sha256").update(apiKey).digest("hex");
    }
    apiKeyPepper() {
        const pepper = process.env.API_KEY_PEPPER;
        if (!pepper && process.env.NODE_ENV === "production")
            throw new Error("API_KEY_PEPPER is required in production");
        return pepper ?? "local-development-api-key-pepper";
    }
    async validateApiKey(apiKey) {
        try {
            const key = await this.getApiKey(apiKey);
            return Boolean(key);
        }
        catch {
            return false;
        }
    }
    async getApiKey(apiKey) {
        const currentHash = this.hashApiKey(apiKey);
        let key = await this.prisma.apiKey.findUnique({ where: { keyHash: currentHash }, include: { rental: true } });
        if (!key) {
            const previousPepper = process.env.API_KEY_PEPPER_PREVIOUS;
            const rolloverActive = Date.now() <= this.apiKeyPepperRolloverUntil;
            const previousHash = previousPepper && rolloverActive
                ? this.hashApiKeyWithPepper(apiKey, previousPepper)
                : null;
            const legacyHash = Date.now() <= this.legacySha256Until ? this.legacyHashApiKey(apiKey) : null;
            key = previousHash
                ? await this.prisma.apiKey.findUnique({ where: { keyHash: previousHash }, include: { rental: true } })
                : null;
            let legacySource = key ? "previous" : null;
            if (!key && legacyHash) {
                key = await this.prisma.apiKey.findUnique({ where: { keyHash: legacyHash }, include: { rental: true } });
                if (key)
                    legacySource = "sha256";
            }
            if (key && legacySource) {
                await this.prisma.apiKey.update({ where: { id: key.id }, data: { keyHash: currentHash } });
                await this.recordLegacyApiKeyHit(key.id, key.prefix, legacySource);
            }
        }
        if (key) {
            if (key.status === "suspended" && key.suspendUntil && key.suspendUntil <= new Date()) {
                key = await this.prisma.apiKey.update({ where: { id: key.id }, data: { status: "active", suspendUntil: null }, include: { rental: true } });
            }
            (0, api_security_1.assertActiveKey)(key);
        }
        return key;
    }
    async recordLegacyApiKeyHit(keyId, prefix, source) {
        const hour = new Date().toISOString().slice(0, 13);
        const logKey = `apikey:legacy-hash:${keyId}:${hour}`;
        if (await this.redis.setIfAbsent(logKey, source, 3600)) {
            this.logger.warn(`API key ${keyId} (${prefix}) matched ${source} hash and was rehashed`);
        }
        const dayKey = `apikey:legacy-hash:count:${source}:${new Date().toISOString().slice(0, 10)}`;
        await this.redis.incr(dayKey, 40 * 24 * 60 * 60);
    }
    apiKeyHasScope(scopes, scope) {
        if (!Array.isArray(scopes))
            return true;
        return scopes.includes(scope);
    }
    async sessionFromAuthorization(authorization) {
        const token = authorization?.replace(/^Bearer\s+/i, "");
        if (!token)
            return null;
        try {
            return await this.verifyJwt(token);
        }
        catch {
            return null;
        }
    }
    async revokeJwt(token) {
        const decoded = this.jwt.verify(token);
        await this.redis.del(`jwt:jti:${decoded.jti}`);
        return { revoked: true };
    }
    decodeJwt(token) {
        return this.jwt.verify(token);
    }
    createApiKey(mode = "live") {
        const raw = `sq_${mode}_${crypto_1.default.randomBytes(24).toString("hex")}`;
        return { raw, prefix: raw.slice(0, 20), hash: this.hashApiKey(raw) };
    }
    async signJwt(payload, ttlSeconds = 60 * 60 * 6) {
        const jti = typeof payload.jti === "string" ? payload.jti : crypto_1.default.randomBytes(18).toString("hex");
        const token = this.jwt.sign({ ...payload, jti }, { expiresIn: ttlSeconds });
        await this.redis.set(`jwt:jti:${jti}`, "active", ttlSeconds);
        return token;
    }
    async signQrJwt(payload, ttlSeconds = 60 * 60 * 24 * 30) {
        return this.signWithSecret(this.qrSecret, payload, ttlSeconds);
    }
    async verifyQrJwt(token) {
        try {
            return await this.verifyWithSecret(token, this.qrSecret);
        }
        catch (primaryError) {
            if (this.legacyQrSecret === this.qrSecret || Date.now() > this.qrLegacyFallbackUntil)
                throw primaryError;
            const decoded = jsonwebtoken_1.default.verify(token, this.legacyQrSecret);
            const hour = new Date().toISOString().slice(0, 13);
            const warningKey = `qr:legacy-fallback:${decoded.jti}:${hour}`;
            if (!(await this.redis.get(warningKey))) {
                await this.redis.set(warningKey, "logged", 60 * 60);
                console.warn("QR JWT verified with legacy JWT_SECRET during secret rollover");
            }
            return this.assertActiveJti(decoded);
        }
    }
    async verifyJwt(token) {
        return this.verifyWithSecret(token, process.env.JWT_SECRET ?? "dev-secret");
    }
    async verifyWithSecret(token, secret) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            return this.assertActiveJti(decoded);
        }
        catch {
            throw new common_1.UnauthorizedException("Invalid token");
        }
    }
    async assertActiveJti(decoded) {
        const active = await this.redis.get(`jwt:jti:${decoded.jti}`);
        if (!active)
            throw new common_1.UnauthorizedException("JWT jti is revoked or expired");
        return decoded;
    }
    signWithSecret(secret, payload, ttlSeconds) {
        const jti = typeof payload.jti === "string" ? payload.jti : crypto_1.default.randomBytes(18).toString("hex");
        const token = jsonwebtoken_1.default.sign({ ...payload, jti }, secret, { expiresIn: ttlSeconds });
        return this.redis.set(`jwt:jti:${jti}`, "active", ttlSeconds).then(() => token);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService, prisma_service_1.PrismaService])
], AuthService);
