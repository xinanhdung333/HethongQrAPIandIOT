import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class ApiRateLimitService implements OnModuleDestroy {
  private readonly local = new Map<string, { count: number; reset: number }>();
  private readonly redis?: Redis;

  constructor() {
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, retryStrategy: () => 2000 });
      this.redis.on("error", () => undefined);
      void this.redis.connect().catch(() => undefined);
    }
  }

  async consume(keyId: string, limit: number, now = Date.now()) {
    const reset = (Math.floor(now / 60_000) + 1) * 60;
    const bucket = `api:rate:${keyId}:${reset}`;
    let count: number;
    if (this.redis?.status === "ready") {
      count = Number(await this.redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, bucket, 61));
    } else {
      // A shared store is mandatory in production; never silently bypass limits.
      if (process.env.NODE_ENV === "production") throw new Error("Redis is required for production API rate limiting");
      if (this.local.size > 10_000) for (const [key, value] of this.local) if (value.reset * 1000 <= now) this.local.delete(key);
      const current = this.local.get(bucket) ?? { count: 0, reset };
      count = ++current.count;
      this.local.set(bucket, current);
    }
    return { limit, remaining: Math.max(0, limit - count), reset, allowed: count <= limit };
  }

  onModuleDestroy() { this.redis?.disconnect(); }
}
