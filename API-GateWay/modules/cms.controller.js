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
exports.CmsController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../services/prisma.service");
let CmsController = class CmsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    pages() {
        return this.prisma.staticPage.findMany({
            where: { published: true },
            orderBy: { sortOrder: "asc" }
        });
    }
    async page(slug) {
        const page = await this.prisma.staticPage.findFirst({ where: { slug, published: true } });
        if (!page)
            throw new common_1.NotFoundException("Static page not found");
        return page;
    }
};
exports.CmsController = CmsController;
__decorate([
    (0, common_1.Get)("pages"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CmsController.prototype, "pages", null);
__decorate([
    (0, common_1.Get)("pages/:slug"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CmsController.prototype, "page", null);
exports.CmsController = CmsController = __decorate([
    (0, common_1.Controller)("cms"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CmsController);
