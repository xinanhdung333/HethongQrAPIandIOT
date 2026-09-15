import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../services/prisma.service";

@Controller("api/v1/status")
export class StatusController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
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

  private uptime(samples: Array<{ healthy: boolean; createdAt: Date }>, days: number) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = samples.filter(sample => sample.createdAt.getTime() >= since);
    if (!rows.length) return null;
    return Math.round((rows.filter(sample => sample.healthy).length / rows.length) * 10000) / 100;
  }
}
