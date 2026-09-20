import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { HttpExceptionFilter } from "./filters/http-exception.filter";
import { AppModule } from "./modules/app.module";
import { validateEnv } from "./config/env-validation";

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  if (process.env.TRUST_PROXY_HOPS) app.getHttpAdapter().getInstance().set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
  app.enableCors({
    origin: Array.from(new Set([
      process.env.WEB_ORIGIN ?? "http://localhost:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://smartqr.vn"
    ])),
    credentials: true,
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After", "X-Request-Id", "Idempotency-Replayed"]
  });
  app.useBodyParser("json", { limit: "8mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "8mb" });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}

void bootstrap();
