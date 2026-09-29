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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../services/prisma.service");
let StatusController = class StatusController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async status() {
        const now = new Date();
        const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const [samples, incidents] = await Promise.all([
            this.prisma.apiStatusSample.findMany({ where: { createdAt: { gte: since30d } }, orderBy: { createdAt: "desc" }, take: 8640 }),
            this.prisma.apiIncident.findMany({ orderBy: { startedAt: "desc" }, take: 5 })
        ]);
        const latest = samples[0];
        const openIncident = incidents.find(item => !item.resolvedAt);
        const status = openIncident?.status === "major" || latest?.healthy === false ? "down" : openIncident ? "degraded" : "operational";
        return {
            status,
            label: status === "operational" ? "Operational" : status === "degraded" ? "Degraded" : "Down",
            checked_at: now.toISOString(),
            uptime_24h: this.uptime(samples, 1),
            uptime_7d: this.uptime(samples, 7),
            uptime_30d: this.uptime(samples, 30),
            latency_ms: latest?.latencyMs ?? null,
            incidents: incidents.map(item => ({ id: item.id, title: item.title, status: item.status, started_at: item.startedAt.toISOString(), resolved_at: item.resolvedAt?.toISOString() ?? null }))
        };
    }
    uptime(samples, days) {
        const since = Date.now() - days * 24 * 60 * 60 * 1000;
        const rows = samples.filter(sample => sample.createdAt.getTime() >= since);
        if (!rows.length)
            return null;
        return Math.round((rows.filter(sample => sample.healthy).length / rows.length) * 10000) / 100;
    }
};
exports.StatusController = StatusController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatusController.prototype, "status", null);
exports.StatusController = StatusController = __decorate([
    (0, common_1.Controller)("api/v1/status"),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StatusController);
