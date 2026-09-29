"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const dto_1 = require("../dto");
const auth_service_1 = require("../security/auth.service");
const api_key_issuance_service_1 = require("../services/api-key-issuance.service");
const prisma_service_1 = require("../services/prisma.service");
const redis_service_1 = require("../services/redis.service");
const activity_log_service_1 = require("../services/activity-log.service");
let AdminController = class AdminController {
    prisma;
    auth;
    redis;
    keys;
    activity;
    constructor(prisma, auth, redis, keys, activity) {
        this.prisma = prisma;
        this.auth = auth;
        this.redis = redis;
        this.keys = keys;
        this.activity = activity;
    }
    async summary(authorization) {
        await this.assertAdmin(authorization);
        const day = new Date().toISOString().slice(0, 10);
        const [users, products, rentals, shows, ticketOrders, tickets, apiKeys, payouts, staticPages, activityLogs, previousHits, sha256Hits] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.product.count(),
            this.prisma.rentalOrder.count(),
            this.prisma.show.count(),
            this.prisma.ticketOrder.count(),
            this.prisma.ticket.count(),
            this.prisma.apiKey.count(),
            this.prisma.payout.count(),
            this.prisma.staticPage.count(),
            this.prisma.activityLog.count(),
            this.redis.get(`apikey:legacy-hash:count:previous:${day}`),
            this.redis.get(`apikey:legacy-hash:count:sha256:${day}`)
        ]);
        const revenue = await this.prisma.ticketOrder.aggregate({
            where: { status: "PAID" },
            _sum: { totalAmount: true, payoutAmount: true, platformFee: true }
        });
        return {
            counts: { users, products, rentals, shows, ticketOrders, tickets, apiKeys, payouts, staticPages, activityLogs },
            revenue: {
                total: revenue._sum.totalAmount ?? 0,
                payout: revenue._sum.payoutAmount ?? 0,
                fee: revenue._sum.platformFee ?? 0
            },
            legacy_api_key_hashes: {
                previous_hits_today: Number(previousHits ?? "0"),
                sha256_hits_today: Number(sha256Hits ?? "0")
            }
        };
    }
    async users(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.user.findMany({
            select: { id: true, email: true, role: true, createdAt: true },
            orderBy: { createdAt: "desc" }
        });
    }
    async products(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.product.findMany({ orderBy: [{ type: "asc" }, { priceSell: "asc" }] });
    }
    async updateProduct(id, dto, authorization) {
        await this.assertAdmin(authorization);
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.price_sell !== undefined)
            data.priceSell = dto.price_sell;
        if (dto.price_rent_month !== undefined)
            data.priceRentMonth = dto.price_rent_month;
        if (dto.deposit_fee !== undefined)
            data.depositFee = dto.deposit_fee;
        if (dto.stock !== undefined)
            data.stock = dto.stock;
        if (dto.images !== undefined)
            data.images = dto.images;
        const product = await this.prisma.product.update({ where: { id }, data });
        await this.redis.del("cache:products");
        return product;
    }
    async orders(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.rentalOrder.findMany({
            include: { product: true, user: { select: { id: true, email: true } } },
            orderBy: { createdAt: "desc" },
            take: 100
        });
    }
    async shows(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.show.findMany({
            include: { owner: { select: { id: true, email: true } }, apiKeys: { select: { prefix: true, status: true, revokeAt: true } } },
            orderBy: { createdAt: "desc" },
            take: 100
        });
    }
    async updateShowStatus(id, dto, authorization) {
        await this.assertAdmin(authorization);
        if (!Object.values(client_1.ShowStatus).includes(dto.status))
            throw new common_1.NotFoundException("Trạng thái show không hợp lệ");
        return this.prisma.show.update({ where: { id }, data: { status: dto.status } });
    }
    async createShowScanKey(id, authorization) {
        await this.assertAdmin(authorization);
        const show = await this.prisma.show.findUnique({ where: { id } });
        if (!show)
            throw new common_1.NotFoundException("Không tìm thấy show");
        const issued = await this.keys.issueKey({ userId: show.ownerId, showId: show.id, scopes: ["ticket:verify"], source: "admin" });
        return { api_key_once: issued.api_key_once, show_id: show.id, key_prefix: issued.key.prefix };
    }
    async rotateShowScanKey(id, body, authorization) {
        const admin = await this.assertAdmin(authorization);
        const show = await this.prisma.show.findUnique({ where: { id } });
        if (!show)
            throw new common_1.NotFoundException("Không tìm thấy show");
        const graceMinutes = body?.grace_minutes ?? 60;
        if (!Number.isInteger(graceMinutes) || graceMinutes < 1 || graceMinutes > 1440) {
            throw new common_1.NotFoundException("Thời gian chuyển key phải từ 1 đến 1440 phút");
        }
        const old = await this.prisma.apiKey.findFirst({ where: { showId: show.id, status: "active" } });
        if (!old)
            throw new common_1.NotFoundException("Show chưa có key máy quét đang hoạt động");
        const revokeAt = new Date(Date.now() + graceMinutes * 60 * 1000);
        const issued = await this.prisma.$transaction(async (tx) => {
            await tx.apiKey.update({ where: { id: old.id }, data: { status: "deprecated", revokeAt } });
            return this.keys.issueKey({ userId: show.ownerId, showId: show.id, scopes: ["ticket:verify"], source: "admin", tx });
        });
        await this.activity.record({
            session: admin,
            action: "ROTATE_SHOW_SCAN_KEY",
            targetType: "ApiKey",
            targetId: old.id,
            metadata: { showId: show.id, replacementKeyId: issued.key.id, graceMinutes }
        });
        return { api_key_once: issued.api_key_once, show_id: show.id, key_prefix: issued.key.prefix, old_revoke_at: revokeAt.toISOString() };
    }
    async updateShowInstallation(id, body, authorization) {
        await this.assertAdmin(authorization);
        const allowed = ["PENDING", "SCHEDULED", "INSTALLING", "READY", "BLOCKED"];
        if (body.status && !allowed.includes(body.status))
            throw new common_1.NotFoundException("Trạng thái lắp đặt không hợp lệ");
        if (body.scanner_count !== undefined && (!Number.isInteger(body.scanner_count) || body.scanner_count < 0)) {
            throw new common_1.NotFoundException("Số máy quét không hợp lệ");
        }
        return this.prisma.show.update({
            where: { id },
            data: {
                ...(body.status ? { installationStatus: body.status } : {}),
                ...(body.scanner_count !== undefined ? { scannerCount: body.scanner_count } : {}),
                ...(body.note !== undefined ? { installationNote: body.note.trim() || null } : {})
            }
        });
    }
    async tickets(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.ticketOrder.findMany({
            include: { show: true, tickets: true, payouts: true },
            orderBy: { createdAt: "desc" },
            take: 100
        });
    }
    async apiKeys(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.apiKey.findMany({
            select: { id: true, prefix: true, quota: true, userId: true, rentalId: true, scopes: true, rateLimit: true, createdAt: true, user: { select: { email: true } }, rental: { select: { appName: true, plan: true } } },
            orderBy: { createdAt: "desc" },
            take: 100
        });
    }
    async activityLogs(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.activityLog.findMany({
            include: { user: { select: { id: true, email: true, role: true } } },
            orderBy: { createdAt: "desc" },
            take: 200
        });
    }
    async createApiKey(dto, authorization) {
        await this.assertAdmin(authorization);
        const user = await this.prisma.user.findUnique({ where: { id: dto.user_id } });
        if (!user)
            throw new common_1.NotFoundException("Không tìm thấy user");
        const rental = await this.prisma.apiRentalOrder.findFirst({ where: { id: dto.rental_id, userId: user.id } });
        const scopes = Array.isArray(rental?.scopes) ? rental.scopes : [];
        const issued = await this.keys.issueKey({ userId: user.id, rentalId: dto.rental_id, scopes: scopes, source: "admin" });
        return { ...issued.key, api_key_once: issued.api_key_once };
    }
    async staticPages(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.staticPage.findMany({ orderBy: { sortOrder: "asc" } });
    }
    async updateStaticPage(slug, dto, authorization) {
        await this.assertAdmin(authorization);
        const data = {};
        if (dto.nav_label !== undefined)
            data.navLabel = dto.nav_label;
        if (dto.title !== undefined)
            data.title = dto.title;
        if (dto.description !== undefined)
            data.description = dto.description;
        if (dto.hero_image !== undefined)
            data.heroImage = dto.hero_image;
        if (dto.cta_primary !== undefined)
            data.ctaPrimary = dto.cta_primary;
        if (dto.cta_secondary !== undefined)
            data.ctaSecondary = dto.cta_secondary;
        if (dto.sections !== undefined)
            data.sections = dto.sections;
        if (dto.sort_order !== undefined)
            data.sortOrder = dto.sort_order;
        if (dto.published !== undefined)
            data.published = dto.published;
        return this.prisma.staticPage.update({ where: { slug }, data });
    }
    async assertAdmin(authorization) {
        if (!this.prisma.isConnected) {
            throw new common_1.ServiceUnavailableException("Admin cần DATABASE_URL thật. Hãy chạy PostgreSQL/Redis và migrate DB.");
        }
        const token = authorization?.replace(/^Bearer\s+/i, "");
        if (!token)
            throw new common_1.UnauthorizedException("Missing admin token");
        const decoded = await this.auth.verifyJwt(token);
        if (decoded.role !== "ADMIN")
            throw new common_1.UnauthorizedException("Admin role required");
        return decoded;
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)("summary"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)("users"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "users", null);
__decorate([
    (0, common_1.Get)("products"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "products", null);
__decorate([
    (0, common_1.Patch)("products/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.AdminUpdateProductDto, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Get)("orders"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "orders", null);
__decorate([
    (0, common_1.Get)("shows"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "shows", null);
__decorate([
    (0, common_1.Patch)("shows/:id/status"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.AdminUpdateShowDto, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateShowStatus", null);
__decorate([
    (0, common_1.Post)("shows/:id/scan-key"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createShowScanKey", null);
__decorate([
    (0, common_1.Post)("shows/:id/scan-key/rotate"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "rotateShowScanKey", null);
__decorate([
    (0, common_1.Patch)("shows/:id/installation"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateShowInstallation", null);
__decorate([
    (0, common_1.Get)("tickets"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "tickets", null);
__decorate([
    (0, common_1.Get)("api-keys"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "apiKeys", null);
__decorate([
    (0, common_1.Get)("activity-logs"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "activityLogs", null);
__decorate([
    (0, common_1.Post)("api-keys"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminCreateApiKeyDto, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createApiKey", null);
__decorate([
    (0, common_1.Get)("static-pages"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "staticPages", null);
__decorate([
    (0, common_1.Patch)("static-pages/:slug"),
    __param(0, (0, common_1.Param)("slug")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.AdminUpdateStaticPageDto, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateStaticPage", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)("admin"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, auth_service_1.AuthService, redis_service_1.RedisService, api_key_issuance_service_1.ApiKeyIssuanceService, activity_log_service_1.ActivityLogService])
], AdminController);
