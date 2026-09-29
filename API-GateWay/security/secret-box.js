"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecret = generateSecret;
exports.sealSecret = sealSecret;
exports.openSecret = openSecret;
const crypto_1 = __importDefault(require("crypto"));
function encryptionKey() {
    const configured = process.env.API_SECRET_ENCRYPTION_KEY;
    if (configured) {
        if (!/^[a-f\d]{64}$/i.test(configured))
            throw new Error("API_SECRET_ENCRYPTION_KEY must contain 64 hexadecimal characters");
        return Buffer.from(configured, "hex");
    }
    if (process.env.NODE_ENV === "production")
        throw new Error("API_SECRET_ENCRYPTION_KEY is required in production");
    return crypto_1.default.createHash("sha256").update(process.env.JWT_SECRET ?? "local-development-secret-box").digest();
}
function generateSecret(prefix = "whsec") {
    return `${prefix}_${crypto_1.default.randomBytes(32).toString("hex")}`;
}
function sealSecret(raw) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
    return `enc:v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}
function openSecret(stored) {
    if (!stored.startsWith("enc:v1:"))
        return stored;
    const [, , iv, tag, encrypted] = stored.split(":");
    const decipher = crypto_1.default.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
}
