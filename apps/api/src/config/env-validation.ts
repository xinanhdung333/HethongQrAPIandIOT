import { Logger } from "@nestjs/common";

const required = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "QR_JWT_SECRET",
  "API_KEY_PEPPER",
  "API_SECRET_ENCRYPTION_KEY",
  "PAYMENT_LINK_SECRET",
  "PAYOS_WEBHOOK_SECRET",
  "WEB_ORIGIN"
] as const;

const devDefaults: Record<string, string> = {
  DATABASE_URL: "local PostgreSQL URL from the environment",
  REDIS_URL: "local Redis URL from the environment",
  JWT_SECRET: "dev-secret",
  QR_JWT_SECRET: "JWT_SECRET/dev-secret fallback",
  API_KEY_PEPPER: "local-development-api-key-pepper",
  API_SECRET_ENCRYPTION_KEY: "SHA-256 derived from JWT_SECRET",
  PAYMENT_LINK_SECRET: "payment-link-dev-secret",
  PAYOS_WEBHOOK_SECRET: "payos-demo-dev-secret",
  WEB_ORIGIN: "http://localhost:3000"
};

export function validateEnv(env: NodeJS.ProcessEnv = process.env) {
  const missing = required.filter((name) => !env[name]?.trim());
  const isProduction = env.NODE_ENV === "production";
  const invalidDates = ["QR_JWT_LEGACY_FALLBACK_UNTIL", "API_KEY_PEPPER_ROLLOVER_UNTIL", "API_KEY_LEGACY_SHA256_UNTIL"]
    .filter(name => env[name] && Number.isNaN(new Date(env[name] as string).getTime()));
  if (invalidDates.length) throw new Error(`Invalid environment configuration (${invalidDates.map(name => `${name} must be a valid ISO date`).join("; ")})`);

  if (isProduction) {
    const invalidLength = ["JWT_SECRET", "QR_JWT_SECRET", "API_KEY_PEPPER", "PAYMENT_LINK_SECRET"]
      .filter((name) => (env[name]?.length ?? 0) < 32);
    const errors = [
      ...(missing.length ? [`missing: ${missing.join(", ")}`] : []),
      ...(invalidLength.length ? [`must be at least 32 characters: ${invalidLength.join(", ")}`] : []),
      ...(env.QR_JWT_SECRET && env.JWT_SECRET && env.QR_JWT_SECRET === env.JWT_SECRET
        ? ["QR_JWT_SECRET must differ from JWT_SECRET"]
        : []),
      ...(env.PAYMENT_DEMO_MODE === "true"
        ? ["PAYMENT_DEMO_MODE must be false or unset in production"]
        : []),
    ];
    if (errors.length) throw new Error(`Invalid production environment configuration (${errors.join("; ")})`);
    return env;
  }

  if (missing.length) {
    const logger = new Logger("EnvValidation");
    logger.warn(`Development environment is missing: ${missing.map((name) => `${name} (using ${devDefaults[name]})`).join(", ")}`);
  }
  return env;
}
