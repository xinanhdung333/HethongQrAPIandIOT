"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const http_exception_filter_1 = require("./filters/http-exception.filter");
const app_module_1 = require("./modules/app.module");
const env_validation_1 = require("./config/env-validation");
async function bootstrap() {
    (0, env_validation_1.validateEnv)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    if (process.env.TRUST_PROXY_HOPS)
        app.getHttpAdapter().getInstance().set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
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
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}
void bootstrap();
