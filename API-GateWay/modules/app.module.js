"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const api_key_guard_1 = require("../security/api-key.guard");
const auth_service_1 = require("../security/auth.service");
const prisma_service_1 = require("../services/prisma.service");
const redis_service_1 = require("../services/redis.service");
const api_audit_middleware_1 = require("../services/api-audit.middleware");
const api_maintenance_service_1 = require("../services/api-maintenance.service");
const api_rate_limit_service_1 = require("../services/api-rate-limit.service");
const developer_service_1 = require("../services/developer.service");
const qr_platform_service_1 = require("../services/qr-platform.service");
const webhook_delivery_service_1 = require("../services/webhook-delivery.service");
const notification_delivery_service_1 = require("../services/notification-delivery.service");
const system_settings_service_1 = require("../services/system-settings.service");
const account_settings_service_1 = require("../services/account-settings.service");
const payment_transactions_service_1 = require("../services/payment-transactions.service");
const activity_log_service_1 = require("../services/activity-log.service");
const api_key_issuance_service_1 = require("../services/api-key-issuance.service");
const gate_sync_service_1 = require("../services/gate-sync.service");
const realtime_gateway_1 = require("../services/realtime.gateway");
const products_controller_1 = require("../modules/products.controller");
const rentals_controller_1 = require("../modules/rentals.controller");
const api_rentals_controller_1 = require("../modules/api-rentals.controller");
const shows_controller_1 = require("../modules/shows.controller");
const tickets_controller_1 = require("../modules/tickets.controller");
const qr_codes_controller_1 = require("../modules/qr-codes.controller");
const dashboard_controller_1 = require("../modules/dashboard.controller");
const webhooks_controller_1 = require("../modules/webhooks.controller");
const auth_controller_1 = require("../modules/auth.controller");
const admin_controller_1 = require("../modules/admin.controller");
const cms_controller_1 = require("../modules/cms.controller");
const developer_controller_1 = require("../modules/developer.controller");
const gates_controller_1 = require("../modules/gates.controller");
const status_controller_1 = require("../modules/status.controller");
const account_settings_controller_1 = require("../modules/account-settings.controller");
const security_controller_1 = require("../modules/security.controller");
const csrf_middleware_1 = require("../security/csrf.middleware");
const settings_payments_controller_1 = require("../modules/settings-payments.controller");
const platform_service_1 = require("../services/platform.service");
const payos_mock_1 = require("../services/payos.mock");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(csrf_middleware_1.CsrfMiddleware, api_audit_middleware_1.ApiAuditMiddleware).forRoutes("*");
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 1000, limit: 10 }])
        ],
        controllers: [
            products_controller_1.ProductsController,
            rentals_controller_1.RentalsController,
            api_rentals_controller_1.ApiRentalsController,
            shows_controller_1.ShowsController,
            tickets_controller_1.TicketsController,
            qr_codes_controller_1.QrCodesController,
            dashboard_controller_1.DashboardController,
            webhooks_controller_1.WebhooksController,
            auth_controller_1.AuthController,
            admin_controller_1.AdminController,
            cms_controller_1.CmsController,
            developer_controller_1.DeveloperController,
            gates_controller_1.GatesController,
            status_controller_1.StatusController,
            account_settings_controller_1.AccountSettingsController,
            settings_payments_controller_1.PaymentsController,
            settings_payments_controller_1.DeveloperPaymentsController,
            settings_payments_controller_1.AdminSettingsPaymentsController,
            security_controller_1.SecurityController
        ],
        providers: [
            prisma_service_1.PrismaService,
            redis_service_1.RedisService,
            api_rate_limit_service_1.ApiRateLimitService,
            api_maintenance_service_1.ApiMaintenanceService,
            developer_service_1.DeveloperService,
            qr_platform_service_1.QrPlatformService,
            webhook_delivery_service_1.WebhookDeliveryService,
            notification_delivery_service_1.NotificationDeliveryService,
            system_settings_service_1.SystemSettingsService,
            account_settings_service_1.AccountSettingsService,
            payment_transactions_service_1.PaymentTransactionsService,
            activity_log_service_1.ActivityLogService,
            api_key_issuance_service_1.ApiKeyIssuanceService,
            gate_sync_service_1.GateSyncService,
            realtime_gateway_1.RealtimeGateway,
            auth_service_1.AuthService,
            platform_service_1.PlatformService,
            payos_mock_1.PayosMockService,
            { provide: core_1.APP_GUARD, useClass: api_key_guard_1.ApiKeyGuard }
        ]
    })
], AppModule);
