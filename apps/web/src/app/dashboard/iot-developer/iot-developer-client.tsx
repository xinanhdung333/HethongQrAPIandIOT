"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { decodeProtectedHeader, importSPKI, jwtVerify, type KeyLike } from "jose";
import { CheckCircle2, Copy, KeyRound, Loader2, RefreshCw, Router, ScanLine, Server, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { API_URL } from "@/lib/api";
import { readPrunedUsedMap } from "@/lib/offline-scan";

type RevokedMap = Record<string, string>;
type UsageEvent = { jti: string; gate_id: string; used_at: string; resource_type: "external_qr" | "ticket" };
type OfflinePayload = { jti?: string; tenant_id?: string; type?: string; resource_type?: string; resource_id?: string; exp?: number };
type SyncState = {
  tenantId: string | null;
  publicKeyCached: boolean;
  revokedCount: number;
  queuedCount: number;
  lastSync: string | null;
};

const SYNC_INTERVAL_MS = 30_000;

export function IotDeveloperClient() {
  const [apiKey, setApiKey] = useState("");
  const [gateId, setGateId] = useState("iot-dev-gate-01");
  const [qrInput, setQrInput] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [log, setLog] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({ tenantId: null, publicKeyCached: false, revokedCount: 0, queuedCount: 0, lastSync: null });
  const publicKeyRef = useRef<KeyLike | null>(null);
  const legacyPublicKeyRef = useRef<KeyLike | null>(null);
  const storageKeys = useMemo(() => iotStorageKeys(apiKey), [apiKey]);

  function pushLog(line: string) {
    setLog((current) => [`${new Date().toLocaleTimeString("vi-VN")} - ${line}`, ...current].slice(0, 60));
  }

  function refreshState() {
    if (!apiKey.trim()) {
      setSyncState({ tenantId: null, publicKeyCached: false, revokedCount: 0, queuedCount: 0, lastSync: null });
      return;
    }
    const revoked = readJson<RevokedMap>(storageKeys.revoked, {});
    const queue = readJson<UsageEvent[]>(storageKeys.queue, []);
    setSyncState({
      tenantId: window.localStorage.getItem(storageKeys.tenantId),
      publicKeyCached: Boolean(window.localStorage.getItem(storageKeys.publicKey)),
      revokedCount: Object.keys(revoked).length,
      queuedCount: queue.length,
      lastSync: window.localStorage.getItem(storageKeys.since)
    });
  }

  useEffect(() => {
    publicKeyRef.current = null;
    legacyPublicKeyRef.current = null;
    if (!apiKey.trim()) return;
    void loadCachedKeys();
    refreshState();
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey.trim() || offlineMode) return;
    void syncDevice();
    const interval = window.setInterval(() => void syncDevice(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [apiKey, offlineMode]);

  async function loadCachedKeys() {
    const publicKey = window.localStorage.getItem(storageKeys.publicKey);
    const legacyPublicKey = window.localStorage.getItem(storageKeys.legacyPublicKey);
    if (publicKey) publicKeyRef.current = await importSPKI(publicKey, "RS256");
    if (legacyPublicKey) legacyPublicKeyRef.current = await importSPKI(legacyPublicKey, "RS256");
  }

  async function fetchPublicKey() {
    assertApiKey(apiKey);
    const response = await fetch(`${API_URL}/api/v1/gates/public-key`, { headers: { "x-api-key": apiKey.trim() } });
    const body = await readBody(response);
    if (!response.ok) throw new Error(messageFromBody(body, "Khong tai duoc public key"));
    const data = body as { public_key: string; tenant_id: string; legacy_public_key?: string | null };
    publicKeyRef.current = await importSPKI(data.public_key, "RS256");
    window.localStorage.setItem(storageKeys.publicKey, data.public_key);
    window.localStorage.setItem(storageKeys.tenantId, data.tenant_id);
    if (data.legacy_public_key) {
      legacyPublicKeyRef.current = await importSPKI(data.legacy_public_key, "RS256");
      window.localStorage.setItem(storageKeys.legacyPublicKey, data.legacy_public_key);
    } else {
      legacyPublicKeyRef.current = null;
      window.localStorage.removeItem(storageKeys.legacyPublicKey);
    }
    pushLog(`Da sync public key cho tenant ${data.tenant_id}`);
  }

  async function syncRevokedDelta() {
    assertApiKey(apiKey);
    const since = window.localStorage.getItem(storageKeys.since) ?? new Date(0).toISOString();
    const response = await fetch(`${API_URL}/api/v1/gates/revoked-delta?since=${encodeURIComponent(since)}`, {
      headers: { "x-api-key": apiKey.trim() }
    });
    const body = await readBody(response);
    if (!response.ok) throw new Error(messageFromBody(body, "Khong sync duoc revoked-delta"));
    const data = body as { revoked: { jti: string; revoked_at: string }[]; server_time: string };
    const revoked = readJson<RevokedMap>(storageKeys.revoked, {});
    for (const item of data.revoked) revoked[item.jti] = item.revoked_at;
    window.localStorage.setItem(storageKeys.revoked, JSON.stringify(revoked));
    window.localStorage.setItem(storageKeys.since, data.server_time);
    pushLog(data.revoked.length ? `Revoked delta +${data.revoked.length}` : "Revoked delta khong co ban ghi moi");
  }

  async function flushQueue() {
    assertApiKey(apiKey);
    const queue = readJson<UsageEvent[]>(storageKeys.queue, []);
    if (!queue.length) {
      pushLog("Queue trong, khong co usage event can day");
      return;
    }
    const response = await fetch(`${API_URL}/api/v1/gates/usage-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim() },
      body: JSON.stringify({ events: queue })
    });
    const body = await readBody(response);
    if (!response.ok) throw new Error(messageFromBody(body, "Khong day duoc usage queue"));
    window.localStorage.setItem(storageKeys.queue, "[]");
    pushLog(`Da day ${queue.length} usage event len server`);
    setResult(body);
  }

  async function syncDevice() {
    if (!apiKey.trim() || offlineMode) return;
    setBusy(true);
    setMessage("");
    try {
      await fetchPublicKey();
      await syncRevokedDelta();
      await flushQueue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync that bai");
      pushLog(`Sync loi: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      refreshState();
      setBusy(false);
    }
  }

  async function verifyOnline() {
    setBusy(true);
    setMessage("");
    try {
      assertApiKey(apiKey);
      const response = await fetch(`${API_URL}/api/v1/tickets/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim() },
        body: JSON.stringify({ ticket_code: qrInput.trim(), gate_id: gateId.trim() || "iot-dev-gate-01" })
      });
      const body = await readBody(response);
      setResult(body);
      pushLog(response.ok ? "Verify online da goi server" : `Verify online bi tu choi HTTP ${response.status}`);
    } catch (error) {
      setResult({ valid: false, error: error instanceof Error ? error.message : "Verify online that bai" });
    } finally {
      setBusy(false);
      refreshState();
    }
  }

  async function verifyOffline() {
    setBusy(true);
    setMessage("");
    try {
      if (!publicKeyRef.current) await loadCachedKeys();
      if (!publicKeyRef.current) throw new Error("Chua co public key cache. Hay bam Sync device khi con mang.");
      const token = offlineTokenFromInput(qrInput);
      if (!token) throw new Error("Khong tim thay qr_offline_jwt trong input");
      const header = decodeProtectedHeader(token);
      if (header.alg !== "RS256") throw new Error(`Token nay la ${header.alg ?? "unknown"}, chi dung cho verify online. Offline can qr_offline_jwt ky RS256.`);
      const payload = await verifyOfflineToken(token);
      const expectedTenantId = window.localStorage.getItem(storageKeys.tenantId);
      if (!expectedTenantId) throw new Error("Chua co tenant_id cache");
      if (payload.tenant_id !== expectedTenantId) throw new Error("Ve khong thuoc tenant cua device nay");
      if (payload.type !== "ticket_offline" && payload.type !== "external_qr_offline") throw new Error("Token offline khong dung loai ho tro");
      if (!payload.jti) throw new Error("Token thieu jti");

      const revoked = readJson<RevokedMap>(storageKeys.revoked, {});
      if (revoked[payload.jti]) {
        const denied = { valid: false, offline: true, reason: `Resource da bi revoke luc ${revoked[payload.jti]}`, jti: payload.jti };
        setResult(denied);
        pushLog(`Offline deny: ${payload.jti} da revoke`);
        return;
      }

      const used = readPrunedUsedMap(storageKeys.used);
      if (used[payload.jti]) {
        const denied = { valid: false, offline: true, reason: `Da quet tren device nay luc ${used[payload.jti]}`, jti: payload.jti };
        setResult(denied);
        pushLog(`Offline deny: ${payload.jti} da used local`);
        return;
      }

      const usedAt = new Date().toISOString();
      used[payload.jti] = usedAt;
      window.localStorage.setItem(storageKeys.used, JSON.stringify(used));
      const queue = readJson<UsageEvent[]>(storageKeys.queue, []);
      queue.push({
        jti: payload.jti,
        gate_id: gateId.trim() || "iot-dev-gate-01",
        used_at: usedAt,
        resource_type: payload.type === "ticket_offline" ? "ticket" : "external_qr"
      });
      window.localStorage.setItem(storageKeys.queue, JSON.stringify(queue));
      setResult({ valid: true, offline: true, jti: payload.jti, resource_type: payload.resource_type, resource_id: payload.resource_id, queued: true });
      pushLog(`Offline allow: ${payload.jti}, da dua vao usage queue`);
    } catch (error) {
      setResult({ valid: false, offline: true, error: error instanceof Error ? error.message : "Verify offline that bai" });
    } finally {
      setBusy(false);
      refreshState();
    }
  }

  async function verifyOfflineToken(token: string) {
    try {
      const { payload } = await jwtVerify<OfflinePayload>(token, publicKeyRef.current!, { algorithms: ["RS256"], clockTolerance: 300 });
      return payload;
    } catch (error) {
      if (!legacyPublicKeyRef.current) throw error;
      const { payload } = await jwtVerify<OfflinePayload>(token, legacyPublicKeyRef.current, { algorithms: ["RS256"], clockTolerance: 300 });
      return payload;
    }
  }

  function clearDeviceCache() {
    for (const key of Object.values(storageKeys)) window.localStorage.removeItem(key);
    publicKeyRef.current = null;
    legacyPublicKeyRef.current = null;
    setResult(null);
    pushLog("Da xoa cache cua device/fingerprint hien tai");
    refreshState();
  }

  async function copyCurl() {
    await navigator.clipboard.writeText(`curl -X POST ${API_URL}/api/v1/tickets/verify \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: ${apiKey.trim() || "$SMARTQR_SCAN_KEY"}" \\
  -d '{"ticket_code":"<qr_jwt_or_ticket_code>","gate_id":"${gateId.trim() || "iot-dev-gate-01"}"}'`);
    pushLog("Da copy lenh cURL verify online");
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">IoT for Developer</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Tich hop may quet truoc khi co phan cung</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Trang nay gia lap mot thiet bi ben ngoai: chi dung API key qua header, cache public key/revoked-delta rieng va day usage queue ve server khi co mang.
          </p>
        </div>
        <button className={`btn ${offlineMode ? "btn-primary" : "btn-secondary"} h-10 text-sm`} onClick={() => setOfflineMode((value) => !value)}>
          {offlineMode ? <WifiOff size={16} /> : <Wifi size={16} />}
          {offlineMode ? "Dang gia lap offline" : "Dang online"}
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <StatusTile icon={<KeyRound size={16} />} label="Device auth" value={apiKey.trim() ? "X-API-KEY set" : "Chua co key"} />
        <StatusTile icon={<ShieldCheck size={16} />} label="Public key" value={syncState.publicKeyCached ? "Da cache" : "Chua sync"} />
        <StatusTile icon={<RefreshCw size={16} />} label="Revoked cache" value={`${syncState.revokedCount} jti`} />
        <StatusTile icon={<Server size={16} />} label="Usage queue" value={`${syncState.queuedCount} event`} />
      </section>

      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel grid gap-5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100"><Router size={18} /></div>
            <div>
              <h2 className="font-semibold">Device config</h2>
              <p className="mt-1 text-sm text-zinc-600">Dung show scan key hoac rental key co scope `ticket:verify`.</p>
            </div>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            API key cua may quet
            <input className="field" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sq_live_... / sk_live_..." />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Gate ID
            <input className="field" value={gateId} onChange={(event) => setGateId(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary h-10 text-sm" onClick={() => void syncDevice()} disabled={busy || offlineMode || !apiKey.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sync device
            </button>
            <button className="btn btn-secondary h-10 text-sm" onClick={() => void flushQueue()} disabled={busy || offlineMode || !apiKey.trim()}>
              <Server size={16} />
              Flush queue
            </button>
            <button className="btn btn-secondary h-10 text-sm" onClick={clearDeviceCache} disabled={!apiKey.trim()}>
              Xoa cache
            </button>
          </div>
          <div className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
            <p>Tenant: <b className="text-zinc-900">{syncState.tenantId ?? "chua biet"}</b></p>
            <p>Last sync: <b className="text-zinc-900">{syncState.lastSync ? new Date(syncState.lastSync).toLocaleString("vi-VN") : "chua sync"}</b></p>
            <p>Cache fingerprint: <code>{apiKey.trim() ? apiKey.trim().slice(0, 10) + "..." : "empty"}</code></p>
          </div>
        </section>

        <aside className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">HTTP sample</h2>
            <button className="btn btn-secondary h-9 px-3 text-xs" onClick={() => void copyCurl()}><Copy size={13} /> Copy</button>
          </div>
          <pre className="mt-4 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{`POST ${API_URL}/api/v1/tickets/verify
X-API-KEY: ${apiKey.trim() || "<scan_key>"}

{
  "ticket_code": "<qr_jwt_or_code>",
  "gate_id": "${gateId}"
}`}</pre>
        </aside>
      </div>

      <section className="panel grid gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Scan sandbox</h2>
            <p className="mt-1 text-sm text-zinc-600">Online goi backend. Offline verify RSA local, check revoked cache va dua usage vao queue.</p>
          </div>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
            {offlineMode ? "Local verify only" : "Backend verify available"}
          </span>
        </div>
        <textarea className="field min-h-36" value={qrInput} onChange={(event) => setQrInput(event.target.value)} placeholder="Dan qr_jwt, ticket_code, qr_offline_jwt hoac JSON response co qr_offline_jwt" />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary h-10 text-sm" onClick={() => void verifyOnline()} disabled={busy || !qrInput.trim() || !apiKey.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
            Verify online
          </button>
          <button className="btn btn-secondary h-10 text-sm" onClick={() => void verifyOffline()} disabled={busy || !qrInput.trim() || !apiKey.trim()}>
            <WifiOff size={16} />
            Verify offline local
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center gap-2"><CheckCircle2 size={17} /><h2 className="font-semibold">Result</h2></div>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-zinc-50 p-4 text-xs leading-6">{JSON.stringify(result, null, 2)}</pre>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">Device log</h2>
          <div className="mt-4 grid max-h-96 gap-2 overflow-auto text-sm">
            {log.map((line, index) => <p key={`${line}:${index}`} className="text-zinc-600">{line}</p>)}
            {!log.length && <p className="text-zinc-500">Chua co log.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2 text-zinc-500">{icon}<span className="text-xs font-medium uppercase">{label}</span></div>
      <p className="mt-2 text-sm font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function iotStorageKeys(apiKey: string) {
  const fingerprint = apiKey.trim().slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, "_") || "empty";
  return {
    publicKey: `iot_dev_public_key_v1:${fingerprint}`,
    legacyPublicKey: `iot_dev_legacy_public_key_v1:${fingerprint}`,
    tenantId: `iot_dev_tenant_id_v1:${fingerprint}`,
    revoked: `iot_dev_revoked_v1:${fingerprint}`,
    since: `iot_dev_since_v1:${fingerprint}`,
    used: `iot_dev_used_v1:${fingerprint}`,
    queue: `iot_dev_queue_v1:${fingerprint}`
  };
}

function offlineTokenFromInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.split(".").length === 3) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as { qr_offline_jwt?: string; qrOfflineJwt?: string; qr?: { offline_jwt?: string }; offline?: { jwt?: string } };
    return parsed.qr_offline_jwt ?? parsed.qrOfflineJwt ?? parsed.qr?.offline_jwt ?? parsed.offline?.jwt ?? null;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

async function readBody(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function messageFromBody(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as { message?: string; error?: string };
    return record.message ?? record.error ?? fallback;
  }
  return typeof body === "string" && body ? body : fallback;
}

function assertApiKey(apiKey: string) {
  if (!apiKey.trim()) throw new Error("Nhap API key cua device truoc");
}
