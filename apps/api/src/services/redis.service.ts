import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis?: Redis;
  private readonly localCache = new Map<string, { value: string; expiresAt?: number }>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) return;

    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null
    });
    this.redis.on("error", () => undefined);
    this.redis.connect().catch(() => console.warn("Redis unavailable. Using local volatile cache for dev."));
  }

  async get(key: string) {
    if (this.redis?.status === "ready") return this.redis.get(key);
    const item = this.localCache.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.localCache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (this.redis?.status === "ready") {
      if (ttlSeconds) await this.redis.set(key, value, "EX", ttlSeconds);
      else await this.redis.set(key, value);
      return;
    }
    this.localCache.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
  }

  async del(key: string) {
    if (this.redis?.status === "ready") await this.redis.del(key);
    this.localCache.delete(key);
  }

  async keys(pattern: string) {
    if (this.redis?.status === "ready") return this.redis.keys(pattern);
    const prefix = pattern.replace(/\*.*$/, "");
    return Array.from(this.localCache.keys()).filter((key) => key.startsWith(prefix));
  }

  async onModuleDestroy() {
    this.redis?.disconnect();
  }
}
