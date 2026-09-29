import { RedisService } from "../services/redis.service";
import { PrismaService } from "../services/prisma.service";
import { ApiKeyScope } from "./api-key.decorator";
export declare const FULL_API_KEY_SCOPES: ApiKeyScope[];
export declare class AuthService {
    private readonly redis;
    private readonly prisma;
    private readonly logger;
    private readonly jwt;
    private readonly qrSecret;
    private readonly legacyQrSecret;
    private readonly qrLegacyFallbackUntil;
    private readonly apiKeyPepperRolloverUntil;
    private readonly legacySha256Until;
    constructor(redis: RedisService, prisma: PrismaService);
    hashPassword(password: string): Promise<string>;
    comparePassword(password: string, hash: string): Promise<boolean>;
    hashApiKey(apiKey: string): string;
    private hashApiKeyWithPepper;
    private legacyHashApiKey;
    private apiKeyPepper;
    validateApiKey(apiKey: string): Promise<boolean>;
    getApiKey(apiKey: string): Promise<any>;
    private recordLegacyApiKeyHit;
    apiKeyHasScope(scopes: unknown, scope: ApiKeyScope): boolean;
    sessionFromAuthorization(authorization?: string): Promise<{
        sub: string;
        email: string;
        role: string;
        jti: string;
    } | null>;
    revokeJwt(token: string): Promise<{
        revoked: boolean;
    }>;
    decodeJwt<T extends {
        jti: string;
    }>(token: string): T;
    createApiKey(mode?: "live" | "test" | "demo"): {
        raw: string;
        prefix: string;
        hash: string;
    };
    signJwt(payload: Record<string, unknown>, ttlSeconds?: number): Promise<string>;
    signQrJwt(payload: Record<string, unknown>, ttlSeconds?: number): Promise<string>;
    verifyQrJwt<T extends {
        jti: string;
    }>(token: string): Promise<T>;
    verifyJwt<T extends {
        jti: string;
    }>(token: string): Promise<T>;
    private verifyWithSecret;
    private assertActiveJti;
    private signWithSecret;
}
