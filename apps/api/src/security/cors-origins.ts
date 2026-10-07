export function getAllowedOrigins() {
  const configuredOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin && origin !== "*" && (
      process.env.NODE_ENV !== "production" ||
      !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
    ));
  const origins = [...configuredOrigins, "https://smartqr.vn"];

  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return Array.from(new Set(origins));
}
