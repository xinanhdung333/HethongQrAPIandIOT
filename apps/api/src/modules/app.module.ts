import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ApiKeyGuard } from "../security/api-key.guard";
import { AuthService } from "../security/auth.service";
import { PrismaService } from "../services/prisma.service";
import { RedisService } from "../services/redis.service";
import { ApiAuditMiddleware } from "../services/api-audit.middleware";
import { ApiMaintenanceService } from "../services/api-maintenance.service";
import { ApiRateLimitService } from "../services/api-rate-limit.service";
import { DeveloperService } from "../services/developer.service";
import { QrPlatformService } from "../services/qr-platform.service";
import { WebhookDeliveryService } from "../services/webhook-delivery.service";
import { NotificationDeliveryService } from "../services/notification-delivery.service";
import { SystemSettingsService } from "../services/system-settings.service";
import { AccountSettingsService } from "../services/account-settings.service";
import { PaymentTransactionsService } from "../services/payment-transactions.service";
import { ActivityLogService } from "../services/activity-log.service";
import { ApiKeyIssuanceService } from "../services/api-key-issuance.service";
import { GateSyncService } from "../services/gate-sync.service";
import { RealtimeGateway } from "../services/realtime.gateway";
import { ProductsController } from "../modules/products.controller";
import { RentalsController } from "../modules/rentals.controller";
import { ApiRentalsController } from "../modules/api-rentals.controller";
import { ShowsController } from "../modules/shows.controller";
import { TicketsController } from "../modules/tickets.controller";
import { QrCodesController } from "../modules/qr-codes.controller";
import { DashboardController } from "../modules/dashboard.controller";
import { WebhooksController } from "../modules/webhooks.controller";
import { AuthController } from "../modules/auth.controller";
import { AdminController } from "../modules/admin.controller";
import { CmsController } from "../modules/cms.controller";
import { DeveloperController } from "../modules/developer.controller";
import { GatesController } from "../modules/gates.controller";
import { StatusController } from "../modules/status.controller";
import { AccountSettingsController } from "../modules/account-settings.controller";
import { SecurityController } from "../modules/security.controller";
import { CsrfMiddleware } from "../security/csrf.middleware";
import { AdminSettingsPaymentsController, DeveloperPaymentsController, PaymentsController } from "../modules/settings-payments.controller";
import { PlatformService } from "../services/platform.service";
import { PayosMockService } from "../services/payos.mock";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 1000, limit: 10 }])
  ],
  controllers: [
    ProductsController,
    RentalsController,
    ApiRentalsController,
    ShowsController,
    TicketsController,
    QrCodesController,
    DashboardController,
    WebhooksController,
    AuthController,
    AdminController,
    CmsController,
    DeveloperController,
    GatesController,
    StatusController,
    AccountSettingsController,
    PaymentsController,
    DeveloperPaymentsController,
    AdminSettingsPaymentsController
    ,SecurityController
  ],
  providers: [
    PrismaService,
    RedisService,
    ApiRateLimitService,
    ApiMaintenanceService,
    DeveloperService,
    QrPlatformService,
    WebhookDeliveryService,
    NotificationDeliveryService,
    SystemSettingsService,
    AccountSettingsService,
    PaymentTransactionsService,
    ActivityLogService,
    ApiKeyIssuanceService,
    GateSyncService,
    RealtimeGateway,
    AuthService,
    PlatformService,
    PayosMockService,
    { provide: APP_GUARD, useClass: ApiKeyGuard }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware, ApiAuditMiddleware).forRoutes("*");
  }
}

