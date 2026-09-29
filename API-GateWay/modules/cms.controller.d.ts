import { PrismaService } from "../services/prisma.service";
export declare class CmsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    pages(): any;
    page(slug: string): Promise<any>;
}
