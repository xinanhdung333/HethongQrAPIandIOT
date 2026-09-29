import { PrismaService } from "../services/prisma.service";
export declare class StatusController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    status(): Promise<{
        status: string;
        label: string;
        checked_at: string;
        uptime_24h: number | null;
        uptime_7d: number | null;
        uptime_30d: number | null;
        latency_ms: any;
        incidents: any;
    }>;
    private uptime;
}
