import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { PrismaService } from "../services/prisma.service";

@Controller("cms")
export class CmsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("pages")
  pages() {
    return this.prisma.staticPage.findMany({
      where: { published: true },
      orderBy: { sortOrder: "asc" }
    });
  }

  @Get("pages/:slug")
  async page(@Param("slug") slug: string) {
    const page = await this.prisma.staticPage.findFirst({ where: { slug, published: true } });
    if (!page) throw new NotFoundException("Static page not found");
    return page;
  }
}
