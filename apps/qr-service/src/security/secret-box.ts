import crypto from "crypto";

function encryptionKey() {
  const configured = process.env.API_SECRET_ENCRYPTION_KEY;
  if (configured) {
    if (!/^[a-f\d]{64}$/i.test(configured)) throw new Error("API_SECRET_ENCRYPTION_KEY must contain 64 hexadecimal characters");
    return Buffer.from(configured, "hex");
  }
  if (process.env.NODE_ENV === "production") throw new Error("API_SECRET_ENCRYPTION_KEY is required in production");
  return crypto.createHash("sha256").update(process.env.JWT_SECRET ?? "local-development-secret-box").digest();
}

export function generateSecret(prefix = "whsec") {
  return `${prefix}_${crypto.randomBytes(32).toString("hex")}`;
}

export function sealSecret(raw: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

export function openSecret(stored: string) {
  if (!stored.startsWith("enc:v1:")) return stored;
  const [, , iv, tag, encrypted] = stored.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
}
