import { lookup } from "node:dns/promises";
import { request as httpRequest, RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 3]
] as const) blockedV4.addSubnet(address, prefix, "ipv4");
const publicV6 = new BlockList();
publicV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  blockedV6.addSubnet(address, prefix, "ipv6");
}

/** Fail closed for loopback, mapped IPv4, link-local, private and reserved ranges. */
export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  if (family === 6) return publicV6.check(address, "ipv6") && !blockedV6.check(address, "ipv6");
  return false;
}

export function allowLocalWebhooks(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WEBHOOK_ALLOW_PRIVATE_URLS === "true";
}

export function parseCallbackUrl(raw: string, allowLocal = allowLocalWebhooks()): URL {
  const url = new URL(raw);
  if (url.username || url.password || url.hash || raw.length > 2048) throw new Error("Invalid callback URL");
  if (url.protocol !== "https:" && !(allowLocal && url.protocol === "http:")) {
    throw new Error("Callback URL must use HTTPS");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowLocal && (hostname === "localhost" || /\.(localhost|local|internal)$/i.test(hostname) || (isIP(hostname) && !isPublicIp(hostname)))) {
    throw new Error("Callback URL must resolve to a public IP address");
  }
  return url;
}

export async function resolveCallbackUrl(raw: string, allowLocal = allowLocalWebhooks()) {
  const url = parseCallbackUrl(raw, allowLocal);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Callback DNS lookup timed out")), 3000); })
    ]);
    if (!addresses.length || (!allowLocal && addresses.some(item => !isPublicIp(item.address)))) {
      throw new Error("Callback URL must resolve only to public IP addresses");
    }
    return { url, address: addresses[0] };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Resolve and validate all DNS answers, then connect to the validated address without a second lookup.
 * The original hostname remains the TLS identity and Host header. Redirects are never followed.
 */
export async function safePostJson(
  rawUrl: string,
  body: string,
  headers: Record<string, string> = {},
  options: { allowLocal?: boolean; timeoutMs?: number } = {}
): Promise<{ statusCode: number }> {
  const { url, address } = await resolveCallbackUrl(rawUrl, options.allowLocal ?? allowLocalWebhooks());
  return new Promise((resolve, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const requestOptions: RequestOptions = {
      method: "POST",
      agent: false,
      headers: { ...headers, "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)) },
      lookup: (_hostname, lookupOptions, callback) => {
        // Node can request either one address or an array (autoSelectFamily).
        if ((lookupOptions as { all?: boolean }).all) (callback as Function)(null, [address]);
        else callback(null, address.address, address.family);
      }
    };
    const req = request(url, requestOptions, res => {
      let received = 0;
      res.on("data", chunk => {
        received += chunk.length;
        if (received > 32768) req.destroy(new Error("Callback response exceeds 32 KiB"));
      });
      res.on("error", reject);
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0 }));
      res.resume();
    });
    const timer = setTimeout(() => req.destroy(new Error("Callback request timed out")), options.timeoutMs ?? 10000);
    req.on("error", reject);
    req.on("close", () => clearTimeout(timer));
    req.end(body);
  });
}
