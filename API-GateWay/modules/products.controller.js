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
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const dto_1 = require("../dto");
const auth_service_1 = require("../security/auth.service");
const activity_log_service_1 = require("../services/activity-log.service");
const platform_service_1 = require("../services/platform.service");
let ProductsController = class ProductsController {
    platform;
    auth;
    activity;
    constructor(platform, auth, activity) {
        this.platform = platform;
        this.auth = auth;
        this.activity = activity;
    }
    async products(authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const products = await this.platform.products();
        await this.activity.record({ session, action: "VIEW_PRODUCTS", targetType: "Product", metadata: { count: products.length }, req });
        return products;
    }
    async buy(id, dto, authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const result = await this.platform.buyProduct(id, dto, session.sub);
        await this.activity.record({ session, action: "BUY_PRODUCT", targetType: "RentalOrder", targetId: result.order_id, metadata: { product_id: id, quantity: dto.quantity, total: result.total }, req });
        return result;
    }
    async allowCustomerOnly(authorization, res) {
        const session = await this.auth.sessionFromAuthorization(authorization);
        if (!session) {
            throw new common_1.UnauthorizedException("Login required");
        }
        if (session.role === "ADMIN") {
            res.status(204).send();
            return null;
        }
        return session;
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)("authorization")),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "products", null);
__decorate([
    (0, common_1.Post)(":id/buy"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.BuyProductDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "buy", null);
exports.ProductsController = ProductsController = __decorate([
    (0, common_1.Controller)("products"),
    __metadata("design:paramtypes", [platform_service_1.PlatformService, auth_service_1.AuthService, activity_log_service_1.ActivityLogService])
], ProductsController);
