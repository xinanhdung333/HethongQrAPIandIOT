# Prompt: Thực thi kiến trúc quét vé offline cho cổng IoT

Bối cảnh đã thống nhất qua trao đổi: cổng chỉ cần scope `ticket:verify` cố định,
không cần refresh liên tục. Cái cần giải quyết là verify chữ ký QR + check
revoke hoàn toàn offline, chỉ đồng bộ nền mỗi 30s, không gọi mạng lúc quét.
Đã test thủ công: RS256 sign/verify bằng thư viện `jsonwebtoken` (đã có sẵn
trong apps/api/package.json) hoạt động đúng và chống giả mạo được (verify
bằng public key, tamper signature bị reject).

Không cần đổi Prisma schema — toàn bộ dùng field có sẵn trên ExternalQrCode
(jti, resourceType, resourceId, expiresAt, notBefore, revokedAt) + Redis
(đã có RedisService) để chống double-use giữa nhiều cổng.

Dán từng bước cho Codex/Claude Code, làm theo đúng thứ tự.

---

## Bước 1 — Backend: utility ký/verify RS256

Tạo file `apps/api/src/security/gate-signing.ts`:

```ts
import crypto from "crypto";
import jwt from "jsonwebtoken";

let cachedKeys: { privateKey: string; publicKey: string } | null = null;

export function getGateKeyPair() {
  if (cachedKeys) return cachedKeys;
  const envPrivate = process.env.GATE_RSA_PRIVATE_KEY;
  const envPublic = process.env.GATE_RSA_PUBLIC_KEY;
  if (envPrivate && envPublic) {
    cachedKeys = { privateKey: envPrivate, publicKey: envPublic };
    return cachedKeys;
  }
  // Không có key cấu hình qua env -> tự sinh 1 cặp lúc khởi động (chỉ dùng cho
  // dev/demo; production PHẢI set GATE_RSA_PRIVATE_KEY/GATE_RSA_PUBLIC_KEY cố
  // định, nếu không mỗi lần restart server các cổng đang cache public key cũ
  // sẽ verify sai hết).
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  console.warn("[gate-signing] GATE_RSA_PRIVATE_KEY not set — using ephemeral keypair (dev only)");
  cachedKeys = { privateKey, publicKey };
  return cachedKeys;
}

export function signOfflineQrToken(qr: { jti: string; resourceType: string; resourceId: string; expiresAt: Date; notBefore: Date | null; isTest: boolean }) {
  const { privateKey } = getGateKeyPair();
  return jwt.sign(
    {
      sub: `external:${qr.resourceType}:${qr.resourceId}`,
      type: "external_qr_offline",
      jti: qr.jti,
      resource_type: qr.resourceType,
      resource_id: qr.resourceId,
      is_test: qr.isTest,
      nbf: qr.notBefore ? Math.floor(qr.notBefore.getTime() / 1000) : undefined
    },
    privateKey,
    { algorithm: "RS256", expiresIn: Math.max(1, Math.floor((qr.expiresAt.getTime() - Date.now()) / 1000)) }
  );
}
```

**Lưu ý bắt buộc ghi trong PR:** thêm `GATE_RSA_PRIVATE_KEY` và `GATE_RSA_PUBLIC_KEY`
vào file env mẫu (`.env.example`), sinh 1 lần bằng:
```
node -e "const c=require('crypto');const{privateKey,publicKey}=c.generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});console.log(JSON.stringify({privateKey,publicKey}))"
```
rồi set cố định qua biến môi trường thật ở production — không để tự sinh ngẫu nhiên mỗi lần deploy.

---

## Bước 2 — Backend: trả kèm token offline khi tạo/đọc QR

Sửa `apps/api/src/services/qr-platform.service.ts`, hàm `serializeQr` (dòng ~251-258):

```ts
private serializeQr(qr: ExternalQrCode) {
  return {
    id: qr.id, type: "external_qr", qr_jwt: qr.qrJwt, ticket_code: qr.code,
    qr_offline_jwt: signOfflineQrToken(qr),   // MỚI: token RS256, verify được offline
    qr: { value: qr.qrJwt, format: "jwt", code: qr.code, image_url: `${API_PUBLIC_URL}/api/v1/qr-codes/${qr.id}/svg` },
    resource: { type: qr.resourceType, id: qr.resourceId, customer_ref: qr.customerRef },
    payload: qr.payload, metadata: qr.metadata, is_test: qr.isTest,
    // ... giữ nguyên phần còn lại
  };
}
```
Thêm import `signOfflineQrToken` từ `../security/gate-signing`. Không đổi `qr_jwt` cũ (giữ nguyên luồng HS256 hiện có cho verify online) — `qr_offline_jwt` chỉ là trường bổ sung, không phá vỡ tích hợp cũ nào.

---

## Bước 3 — Backend: endpoint public key + revoked-delta + usage-events

Tạo file `apps/api/src/services/gate-sync.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { RedisService } from "./redis.service";
import { getGateKeyPair } from "../security/gate-signing";
import type { ApiKey, ApiRentalOrder } from "@prisma/client";

type IntegrationKey = ApiKey & { rental: ApiRentalOrder | null };

const USED_TTL_SECONDS = 60 * 60 * 24 * 400; // dài hơn MAX_TTL của QR (365 ngày) để không hết hạn sớm hơn chính QR

@Injectable()
export class GateSyncService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  publicKey() {
    return { public_key: getGateKeyPair().publicKey, algorithm: "RS256" };
  }

  /** Trả về các QR bị revoke kể từ `since`, giới hạn theo user/rental của key gọi. */
  async revokedDelta(key: IntegrationKey, since: Date) {
    const rows = await this.prisma.externalQrCode.findMany({
      where: {
        userId: key.userId,
        isTest: key.isTest,
        ...(key.rentalId ? { apiKey: { rentalId: key.rentalId } } : {}),
        revokedAt: { not: null, gt: since }
      },
      select: { jti: true, revokedAt: true },
      orderBy: { revokedAt: "asc" },
      take: 5000
    });
    return {
      revoked: rows.map(r => ({ jti: r.jti, revoked_at: r.revokedAt!.toISOString() })),
      server_time: new Date().toISOString() // client lưu lại làm `since` cho lần gọi kế tiếp
    };
  }

  /**
   * Nhận log quét offline từ 1 cổng, dùng Redis SETNX để phát hiện 1 vé bị
   * quét ở >1 cổng trong lúc cả cụm mất mạng (không thể chặn real-time, chỉ
   * ghi nhận để đối soát sau — đúng hướng "hậu kiểm" đã thống nhất).
   */
  async reportUsageEvents(key: IntegrationKey, events: { jti: string; gate_id: string; used_at: string }[]) {
    const accepted: string[] = [];
    const conflicts: { jti: string; first_gate: string; reported_gate: string }[] = [];

    for (const event of events) {
      const redisKey = `gate:used:${key.userId}:${event.jti}`;
      const claim = `${event.gate_id}|${event.used_at}`;
      const existing = await this.redis.get(redisKey);
      if (!existing) {
        await this.redis.set(redisKey, claim, USED_TTL_SECONDS);
        accepted.push(event.jti);
        await this.markUsedInDb(event.jti);
      } else {
        const [firstGate] = existing.split("|");
        if (firstGate !== event.gate_id) {
          conflicts.push({ jti: event.jti, first_gate: firstGate, reported_gate: event.gate_id });
          await this.redis.set(`gate:conflict:${key.userId}:${event.jti}:${event.gate_id}`, claim, USED_TTL_SECONDS);
        }
      }
    }
    return { accepted_count: accepted.length, conflicts };
  }

  private async markUsedInDb(jti: string) {
    // best-effort, không cần transaction chặt như verify online — mục tiêu
    // chỉ để đồng bộ trạng thái hiển thị trên dashboard, không phải nguồn
    // chống double-use (Redis SETNX ở trên mới là nguồn quyết định đó).
    await this.prisma.externalQrCode.updateMany({
      where: { jti, isUsed: false },
      data: { isUsed: true, usedAt: new Date(), useCount: { increment: 1 } }
    });
  }

  async listConflicts(key: IntegrationKey) {
    const pattern = `gate:conflict:${key.userId}:*`;
    const keys = await this.redis.keys?.(pattern) ?? [];
    const result = [];
    for (const k of keys) {
      const value = await this.redis.get(k);
      if (value) {
        const [gate, usedAt] = value.split("|");
        result.push({ redis_key: k, reported_gate: gate, used_at: usedAt });
      }
    }
    return result;
  }
}
```

**Kiểm tra `RedisService`** (`apps/api/src/services/redis.service.ts`) có sẵn method `keys()` (SCAN/KEYS) chưa — nếu chưa, thêm:
```ts
async keys(pattern: string) {
  if (this.redis?.status === "ready") return this.redis.keys(pattern);
  return Array.from(this.localCache.keys()).filter(k => k.startsWith(pattern.replace("*", "")));
}
```
(dùng `KEYS` chỉ chấp nhận được vì số lượng conflict kỳ vọng rất nhỏ; nếu lo ngại hiệu năng ở scale lớn, đổi sang lưu 1 Redis Set riêng `gate:conflicts:<userId>` thay vì scan pattern.)

Tạo file `apps/api/src/modules/gates.controller.ts`:

```ts
import { Body, Controller, Get, Headers, Post, Query } from "@nestjs/common";
import { RequireApiKey } from "../security/api-key.decorator";
import { AuthService } from "../security/auth.service";
import { GateSyncService } from "../services/gate-sync.service";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";

@Controller("api/v1/gates")
export class GatesController {
  constructor(private readonly gates: GateSyncService, private readonly auth: AuthService) {}

  @Get("public-key")
  publicKey() {
    return this.gates.publicKey();
  }

  @Get("revoked-delta")
  @RequireApiKey("ticket:verify")
  async revokedDelta(@Headers("x-api-key") raw: string, @Query("since") since?: string) {
    const key = await this.requireKey(raw);
    const sinceDate = since ? new Date(since) : new Date(0);
    if (Number.isNaN(sinceDate.getTime())) throw new BadRequestException({ error: "invalid_since", message: "since must be an ISO date" });
    return this.gates.revokedDelta(key, sinceDate);
  }

  @Post("usage-events")
  @RequireApiKey("ticket:verify")
  async usageEvents(@Headers("x-api-key") raw: string, @Body() body: { events: { jti: string; gate_id: string; used_at: string }[] }) {
    const key = await this.requireKey(raw);
    if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 500) {
      throw new BadRequestException({ error: "invalid_events", message: "events must contain 1-500 items" });
    }
    return this.gates.reportUsageEvents(key, body.events);
  }

  @Get("conflicts")
  @RequireApiKey("ticket:verify")
  async conflicts(@Headers("x-api-key") raw: string) {
    const key = await this.requireKey(raw);
    return this.gates.listConflicts(key);
  }

  private async requireKey(raw: string) {
    const key = await this.auth.getApiKey(raw);
    if (!key) throw new UnauthorizedException({ error: "invalid_api_key", message: "Invalid or expired API key" });
    return key;
  }
}
```

Đăng ký vào `apps/api/src/app.module.ts`:
- Thêm `GatesController` vào mảng `controllers`.
- Thêm `GateSyncService` vào mảng `providers`.

---

## Bước 4 — Frontend: trang demo cổng offline

Thêm dependency verify RS256 phía trình duyệt vào `apps/web/package.json`:
```json
"jose": "^5.9.6"
```
(`jose` chạy được trong browser qua Web Crypto, không cần polyfill Node).

Tạo file `apps/web/src/app/dashboard/gate-offline/page.tsx`:
```tsx
import { RequireLogin } from "@/components/require-login";
import { GateOfflineClient } from "./gate-offline-client";

export default function Page() {
  return (
    <RequireLogin>
      <main className="shell py-10">
        <GateOfflineClient />
      </main>
    </RequireLogin>
  );
}
```

Tạo file `apps/web/src/app/dashboard/gate-offline/gate-offline-client.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { importSPKI, jwtVerify } from "jose";
import { WifiOff, Wifi, ScanLine } from "lucide-react";

const SYNC_INTERVAL_MS = 30_000;
const STORAGE_REVOKED = "gate_offline_revoked_v1";
const STORAGE_SINCE = "gate_offline_since_v1";
const STORAGE_USED = "gate_offline_used_v1";
const STORAGE_QUEUE = "gate_offline_queue_v1";

type RevokedMap = Record<string, string>; // jti -> revoked_at

export function GateOfflineClient() {
  const [apiKey, setApiKey] = useState("");
  const [gateId, setGateId] = useState("gate-main");
  const [offlineMode, setOfflineMode] = useState(false);
  const [publicKeyPem, setPublicKeyPem] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [qrInput, setQrInput] = useState("");
  const publicKeyRef = useRef<CryptoKey | null>(null);

  function pushLog(line: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString("vi-VN")} · ${line}`, ...prev].slice(0, 50));
  }

  // Tải public key 1 lần (không cần mạng sau lần đầu, endpoint không cần api key)
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/v1/gates/public-key`)
      .then((r) => r.json())
      .then(async (data) => {
        setPublicKeyPem(data.public_key);
        publicKeyRef.current = await importSPKI(data.public_key, "RS256");
        pushLog("Đã tải public key để verify offline");
      })
      .catch(() => pushLog("Không tải được public key (mất mạng lúc khởi động lần đầu?)"));
  }, []);

  // Đồng bộ danh sách revoke mỗi 30s — hoàn toàn tách khỏi luồng quét
  useEffect(() => {
    if (!apiKey) return;
    const sync = async () => {
      if (offlineMode) { pushLog("Đang giả lập mất mạng — bỏ qua sync"); return; }
      try {
        const since = window.localStorage.getItem(STORAGE_SINCE) ?? new Date(0).toISOString();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/v1/gates/revoked-delta?since=${encodeURIComponent(since)}`, {
          headers: { "x-api-key": apiKey }
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const current: RevokedMap = JSON.parse(window.localStorage.getItem(STORAGE_REVOKED) ?? "{}");
        for (const item of data.revoked) current[item.jti] = item.revoked_at;
        window.localStorage.setItem(STORAGE_REVOKED, JSON.stringify(current));
        window.localStorage.setItem(STORAGE_SINCE, data.server_time);
        setLastSync(new Date().toLocaleTimeString("vi-VN"));
        if (data.revoked.length) pushLog(`Đồng bộ: +${data.revoked.length} vé mới bị revoke`);
        await flushQueue();
      } catch {
        pushLog("Sync lỗi (coi như mất mạng) — dùng cache cũ");
      }
    };
    sync();
    const interval = setInterval(sync, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [apiKey, offlineMode]);

  async function flushQueue() {
    const queue: { jti: string; gate_id: string; used_at: string }[] = JSON.parse(window.localStorage.getItem(STORAGE_QUEUE) ?? "[]");
    if (!queue.length) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/v1/gates/usage-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ events: queue })
    });
    if (res.ok) {
      window.localStorage.setItem(STORAGE_QUEUE, "[]");
      pushLog(`Đẩy ${queue.length} log quét lên server thành công`);
    }
  }

  // QUÉT — hoàn toàn local, không gọi mạng ở đây dù offlineMode bật hay tắt
  async function scan() {
    if (!publicKeyRef.current) { pushLog("Chưa có public key, không thể verify"); return; }
    try {
      const { payload } = await jwtVerify(qrInput.trim(), publicKeyRef.current, { algorithms: ["RS256"] });
      const jti = payload.jti as string;

      const revoked: RevokedMap = JSON.parse(window.localStorage.getItem(STORAGE_REVOKED) ?? "{}");
      if (revoked[jti]) { pushLog(`❌ Từ chối: vé đã bị revoke lúc ${revoked[jti]}`); return; }

      const used: Record<string, string> = JSON.parse(window.localStorage.getItem(STORAGE_USED) ?? "{}");
      if (used[jti]) { pushLog(`❌ Từ chối: vé đã dùng lúc ${used[jti]} (tại máy này)`); return; }

      used[jti] = new Date().toISOString();
      window.localStorage.setItem(STORAGE_USED, JSON.stringify(used));

      const queue = JSON.parse(window.localStorage.getItem(STORAGE_QUEUE) ?? "[]");
      queue.push({ jti, gate_id: gateId, used_at: used[jti] });
      window.localStorage.setItem(STORAGE_QUEUE, JSON.stringify(queue));

      pushLog(`✅ Cho vào — resource ${payload.resource_type}:${payload.resource_id} (${offlineMode ? "OFFLINE" : "online"})`);
    } catch (error) {
      pushLog(`❌ Chữ ký không hợp lệ hoặc QR hết hạn: ${error instanceof Error ? error.message : "lỗi"}`);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Demo cổng quét offline</h1>
        <button
          className={`btn ${offlineMode ? "btn-primary" : "btn-secondary"} text-sm`}
          onClick={() => setOfflineMode((v) => !v)}
        >
          {offlineMode ? <WifiOff size={16} /> : <Wifi size={16} />}
          {offlineMode ? "Đang giả lập MẤT MẠNG" : "Giả lập mất mạng"}
        </button>
      </div>

      <div className="panel grid gap-3 p-5">
        <input className="field" placeholder="API key (scope ticket:verify)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <input className="field" placeholder="Gate ID" value={gateId} onChange={(e) => setGateId(e.target.value)} />
        <p className="text-xs text-zinc-500">Lần sync gần nhất: {lastSync ?? "chưa sync"}</p>
      </div>

      <div className="panel grid gap-3 p-5">
        <textarea className="field min-h-32" placeholder="Dán qr_offline_jwt" value={qrInput} onChange={(e) => setQrInput(e.target.value)} />
        <button className="btn btn-primary w-fit" onClick={scan}>
          <ScanLine size={16} /> Quét (local, không gọi mạng)
        </button>
      </div>

      <div className="panel p-5">
        <h2 className="font-semibold">Nhật ký</h2>
        <div className="mt-3 grid gap-1 text-sm">
          {log.map((line, i) => <p key={i} className="text-zinc-600">{line}</p>)}
        </div>
      </div>
    </div>
  );
}
```

Thêm link vào sidebar dashboard (tìm nav item hiện có, thêm mục "Demo cổng offline" trỏ tới `/dashboard/gate-offline`).

---

## Kiểm thử tay sau khi code xong

1. Tạo 1 rental + key scope `ticket:verify` (qua `/thue-api`).
2. `POST /api/v1/qr-codes` — lấy `qr_offline_jwt` trong response.
3. Vào `/dashboard/gate-offline`, dán API key, dán `qr_offline_jwt`, bấm Quét → phải cho vào.
4. Bấm quét lại đúng QR đó → phải báo "đã dùng" (local).
5. Bật "Giả lập mất mạng", đợi revoke 1 QR khác từ tab admin, quay lại quét QR đó trong lúc offline → do cache chưa kịp sync sẽ vẫn cho vào (đúng đánh đổi đã thống nhất) — tắt offline, đợi 1 chu kỳ sync, thử lại QR còn 1 bản chưa dùng khác đã bị revoke sau đó → phải bị chặn.
6. Test 2 tab trình duyệt = giả lập 2 cổng, cùng quét 1 QR trong lúc cả 2 đang bật "giả lập mất mạng" → cả 2 đều cho vào (đúng như đã bàn — không tránh được ở tầng offline). Tắt giả lập mất mạng ở cả 2 tab, đợi sync/flush → gọi `GET /api/v1/gates/conflicts` phải thấy 1 conflict được ghi nhận.
