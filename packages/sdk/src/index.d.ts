export interface RequestOptions { idempotencyKey?: string; signal?: AbortSignal }
export interface ResourceInput {
  resource_type: string; resource_id: string; customer_ref?: string; ttl_seconds?: number;
  payload?: Record<string, unknown>; metadata?: Record<string, unknown>;
  max_uses?: number; allowed_gate_ids?: string[]; not_before?: string;
}
export interface QrCode {
  id: string; qr_jwt: string; ticket_code: string; is_test?: boolean; expires_at: string;
  qr: { format: string; value: string; code: string; image_url: string };
  resource: { type: string; id: string; customer_ref?: string };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface Verification {
  valid: boolean; reason?: string; metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface GateUsageEvent {
  jti: string; gate_id: string; used_at: string; resource_type: "external_qr" | "ticket";
}
export interface GateUsageRejection {
  jti: string; reason: "out_of_show_scope";
}
export interface GateUsageSyncResult {
  accepted_count: number;
  conflicts: { jti: string; first_gate: string; reported_gate: string }[];
  rejected: GateUsageRejection[];
}
export class SmartQrError extends Error {
  code: string; status: number; requestId?: string; retryAfter?: string; body?: unknown;
}
export function signRequest(secret: string, timestamp: string, method: string, path: string, body?: string): string;
export function verifyWebhookSignature(rawBody: string | Uint8Array, signature: string | undefined, secret: string): boolean;
export class SmartQrClient {
  constructor(options: { apiKey: string; baseUrl?: string; signingSecret?: string; timeoutMs?: number; fetch?: typeof fetch });
  request<T = unknown>(method: string, path: string, input?: unknown, options?: RequestOptions): Promise<T>;
  createQrCode(resource: ResourceInput, options?: RequestOptions): Promise<QrCode>;
  createQrCodes(resources: ResourceInput[], options?: RequestOptions): Promise<unknown>;
  verifyTicket(input: { qr_jwt?: string; ticket_code?: string; gate_id?: string }, options?: RequestOptions): Promise<Verification>;
  getQrSvgUrl(id: string): string;
  getQrSvg(id: string, options?: RequestOptions): Promise<string>;
}
