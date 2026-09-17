"use client";

import { useEffect, useRef, useState } from "react";
import { importSPKI, jwtVerify, type KeyLike } from "jose";
import { ScanLine, Wifi, WifiOff } from "lucide-react";
import { API_URL } from "@/lib/api";
import { readPrunedUsedMap } from "@/lib/offline-scan";

const SYNC_INTERVAL_MS = 30_000;

type RevokedMap = Record<string, string>;
type UsageEvent = { jti: string; gate_id: string; used_at: string; resource_type: "external_qr" | "ticket" };
type OfflinePayload = { jti?: string; tenant_id?: string; type?: string; resource_type?: string; resource_id?: string };

export function GateOfflineClient() {
  const [apiKey, setApiKey] = useState("");
  const [offlineEnableKey, setOfflineEnableKey] = useState("");
  const [gateId, setGateId] = useState("gate-main");
  const [offlineMode, setOfflineMode] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [qrInput, setQrInput] = useState("");
  const [expectedTenantId, setExpectedTenantId] = useState<string | null>(null);
  const [publicKeyReload, setPublicKeyReload] = useState(0);
  const publicKeyRef = useRef<KeyLike | null>(null);
  const legacyPublicKeyRef = useRef<KeyLike | null>(null);

  function pushLog(line: string) {
    setLog((current) => [`${new Date().toLocaleTimeString("vi-VN")} - ${line}`, ...current].slice(0, 50));
  }

  useEffect(() => {
    publicKeyRef.current = null;
    legacyPublicKeyRef.current = null;
    setExpectedTenantId(null);
    if (!apiKey) return;
    const cacheKeys = offlineStorageKeys(apiKey);
    const loadCachedKey = async () => {
      const cachedPublicKey = window.localStorage.getItem(cacheKeys.publicKey);
      const cachedTenantId = window.localStorage.getItem(cacheKeys.tenantId);
      const cachedLegacyPublicKey = window.localStorage.getItem(cacheKeys.legacyPublicKey);
      if (cachedPublicKey && cachedTenantId) {
        publicKeyRef.current = await importSPKI(cachedPublicKey, "RS256");
        setExpectedTenantId(cachedTenantId);
      }
      if (cachedLegacyPublicKey) legacyPublicKeyRef.current = await importSPKI(cachedLegacyPublicKey, "RS256");
    };
    const fetchPublicKey = async () => {
      await loadCachedKey();
      if (offlineMode) return;
      try {
        const response = await fetch(`${API_URL}/api/v1/gates/public-key`, { headers: { "x-api-key": apiKey } });
        if (!response.ok) {
          const text = await response.text();
          try {
            const body = JSON.parse(text) as { error?: string; message?: string };
            if (body.error === "tenant_offline_disabled") pushLog("Tenant chua bat che do quet offline");
            else pushLog(body.message ?? body.error ?? "Khong tai duoc public key");
          } catch {
            pushLog("Khong tai duoc public key");
          }
          return;
        }
        const data = await response.json() as { public_key: string; tenant_id: string; legacy_public_key?: string | null };
        publicKeyRef.current = await importSPKI(data.public_key, "RS256");
        setExpectedTenantId(data.tenant_id);
        window.localStorage.setItem(cacheKeys.publicKey, data.public_key);
        window.localStorage.setItem(cacheKeys.tenantId, data.tenant_id);
        if (data.legacy_public_key) {
          legacyPublicKeyRef.current = await importSPKI(data.legacy_public_key, "RS256");
          window.localStorage.setItem(cacheKeys.legacyPublicKey, data.legacy_public_key);
        } else {
          legacyPublicKeyRef.current = null;
          window.localStorage.removeItem(cacheKeys.legacyPublicKey);
        }
        pushLog("Da tai public key theo tenant de verify offline");
      } catch {
        pushLog("Khong tai duoc public key - dung cache neu co");
      }
    };
    void fetchPublicKey();
  }, [apiKey, offlineMode, publicKeyReload]);

  useEffect(() => {
    if (!apiKey) return;
    const sync = async () => {
      if (offlineMode) {
        pushLog("Dang gia lap mat mang - bo qua sync");
        return;
      }
      try {
        const storageKeys = offlineStorageKeys(apiKey);
        const since = window.localStorage.getItem(storageKeys.since) ?? new Date(0).toISOString();
        const response = await fetch(`${API_URL}/api/v1/gates/revoked-delta?since=${encodeURIComponent(since)}`, {
          headers: { "x-api-key": apiKey }
        });
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json() as { revoked: { jti: string; revoked_at: string }[]; server_time: string };
        const current: RevokedMap = JSON.parse(window.localStorage.getItem(storageKeys.revoked) ?? "{}");
        for (const item of data.revoked) current[item.jti] = item.revoked_at;
        window.localStorage.setItem(storageKeys.revoked, JSON.stringify(current));
        window.localStorage.setItem(storageKeys.since, data.server_time);
        setLastSync(new Date().toLocaleTimeString("vi-VN"));
        if (data.revoked.length) pushLog(`Dong bo: +${data.revoked.length} ve moi bi revoke`);
        await flushQueue();
      } catch {
        pushLog("Sync loi - dung cache cu");
      }
    };
    void sync();
    const interval = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [apiKey, offlineMode]);

  async function flushQueue() {
    const storageKeys = offlineStorageKeys(apiKey);
    const queue: UsageEvent[] = JSON.parse(window.localStorage.getItem(storageKeys.queue) ?? "[]");
    if (!queue.length) return;
    const response = await fetch(`${API_URL}/api/v1/gates/usage-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ events: queue })
    });
    if (response.ok) {
      window.localStorage.setItem(storageKeys.queue, "[]");
      pushLog(`Day ${queue.length} log quet len server thanh cong`);
    }
  }

  async function scan() {
    if (!publicKeyRef.current) {
      pushLog("Chua co public key, khong the verify");
      return;
    }
    if (!expectedTenantId) {
      pushLog("Chua co tenant_id cua may quet, khong the verify");
      return;
    }
    try {
      const payload = await verifyOfflineToken(qrInput.trim());
      if (payload.tenant_id !== expectedTenantId) {
        pushLog("Tu choi: ve khong thuoc tenant cua may quet nay");
        return;
      }
      if (payload.type !== "external_qr_offline" && payload.type !== "ticket_offline") {
        pushLog("Tu choi: token khong phai external_qr_offline hoac ticket_offline");
        return;
      }
      const jti = payload.jti;
      if (!jti) {
        pushLog("Tu choi: QR thieu jti");
        return;
      }

      const storageKeys = offlineStorageKeys(apiKey);
      const revoked: RevokedMap = JSON.parse(window.localStorage.getItem(storageKeys.revoked) ?? "{}");
      if (revoked[jti]) {
        pushLog(`Tu choi: ve da bi revoke luc ${revoked[jti]}`);
        return;
      }

      const used = readPrunedUsedMap(storageKeys.used);
      if (used[jti]) {
        pushLog(`Tu choi: ve da dung luc ${used[jti]} tai may nay`);
        return;
      }

      used[jti] = new Date().toISOString();
      window.localStorage.setItem(storageKeys.used, JSON.stringify(used));

      const queue: UsageEvent[] = JSON.parse(window.localStorage.getItem(storageKeys.queue) ?? "[]");
      queue.push({ jti, gate_id: gateId, used_at: used[jti], resource_type: payload.type === "ticket_offline" ? "ticket" : "external_qr" });
      window.localStorage.setItem(storageKeys.queue, JSON.stringify(queue));

      pushLog(`Cho vao - resource ${payload.resource_type}:${payload.resource_id} (${offlineMode ? "OFFLINE" : "online"})`);
    } catch (error) {
      pushLog(`Chu ky khong hop le hoac QR het han: ${error instanceof Error ? error.message : "loi"}`);
    }
  }

  async function enableOffline() {
    const enableKey = offlineEnableKey.trim();
    if (!enableKey) {
      pushLog("Nhap API key co scope qr:create truoc khi bat offline");
      return;
    }
    if (!confirm("Sau khi bat, khong the tat lai. Ve phat hanh sau thoi diem nay se co them qr_offline_jwt de may quet xac thuc khong can mang. Tiep tuc?")) return;
    try {
      const response = await fetch(`${API_URL}/api/v1/gates/tenant-settings/enable-offline`, {
        method: "POST",
        headers: { "x-api-key": enableKey }
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json() as { tenant_id: string };
      pushLog(`Da bat che do quet offline cho tenant ${data.tenant_id}`);
      publicKeyRef.current = null;
      legacyPublicKeyRef.current = null;
      setExpectedTenantId(null);
      window.localStorage.removeItem(offlineStorageKeys(apiKey).publicKey);
      window.localStorage.removeItem(offlineStorageKeys(apiKey).tenantId);
      window.localStorage.removeItem(offlineStorageKeys(apiKey).legacyPublicKey);
      setPublicKeyReload((value) => value + 1);
    } catch (error) {
      pushLog(`Khong bat duoc che do offline: ${error instanceof Error ? error.message : "loi"}`);
    }
  }

  async function verifyOfflineToken(token: string) {
    try {
      const { payload } = await jwtVerify<OfflinePayload>(token, publicKeyRef.current!, { algorithms: ["RS256"], clockTolerance: 300 });
      return payload;
    } catch (error) {
      if (!legacyPublicKeyRef.current) throw error;
      const { payload } = await jwtVerify<OfflinePayload>(token, legacyPublicKeyRef.current, { algorithms: ["RS256"], clockTolerance: 300 });
      if (payload.tenant_id) throw error;
      return { ...payload, tenant_id: expectedTenantId ?? undefined };
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Demo cong quet offline</h1>
        <button className={`btn ${offlineMode ? "btn-primary" : "btn-secondary"} text-sm`} onClick={() => setOfflineMode((value) => !value)}>
          {offlineMode ? <WifiOff size={16} /> : <Wifi size={16} />}
          {offlineMode ? "Dang gia lap MAT MANG" : "Gia lap mat mang"}
        </button>
      </div>

      <div className="panel grid gap-3 p-5">
        <input className="field" placeholder="API key (scope ticket:verify)" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        <input className="field" placeholder="API key (scope qr:create) - chi dung de bat offline" value={offlineEnableKey} onChange={(event) => setOfflineEnableKey(event.target.value)} />
        <input className="field" placeholder="Gate ID" value={gateId} onChange={(event) => setGateId(event.target.value)} />
        <p className="text-xs text-zinc-500">Tenant dang cau hinh: {expectedTenantId ?? "chua tai public key"}</p>
        <p className="text-xs text-zinc-500">Lan sync gan nhat: {lastSync ?? "chua sync"}</p>
        <button className="btn btn-secondary w-fit text-sm" onClick={() => void enableOffline()}>Bat che do quet offline</button>
      </div>

      <div className="panel grid gap-3 p-5">
        <textarea className="field min-h-32" placeholder="Dan qr_offline_jwt" value={qrInput} onChange={(event) => setQrInput(event.target.value)} />
        <button className="btn btn-primary w-fit" onClick={() => void scan()}><ScanLine size={16} /> Quet (local, khong goi mang)</button>
      </div>

      <div className="panel p-5">
        <h2 className="font-semibold">Nhat ky</h2>
        <div className="mt-3 grid gap-1 text-sm">
          {log.map((line, index) => <p key={`${line}:${index}`} className="text-zinc-600">{line}</p>)}
          {!log.length && <p className="text-zinc-500">Chua co su kien.</p>}
        </div>
      </div>
    </div>
  );
}

function offlineStorageKeys(apiKey: string) {
  const fingerprint = apiKey.trim().slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, "_");
  return {
    publicKey: `gate_offline_public_key_v1:${fingerprint}`,
    legacyPublicKey: `gate_offline_legacy_public_key_v1:${fingerprint}`,
    tenantId: `gate_offline_tenant_id_v1:${fingerprint}`,
    revoked: `gate_offline_revoked_v1:${fingerprint}`,
    since: `gate_offline_since_v1:${fingerprint}`,
    used: `gate_offline_used_v1:${fingerprint}`,
    queue: `gate_offline_queue_v1:${fingerprint}`
  };
}
