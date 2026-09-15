import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request } from "express";
import { PrismaService } from "./prisma.service";

type UserSession = { sub: string; email: string; role: string; jti: string };

type ActivityInput = {
  session: UserSession;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  req?: Request;
};

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: ActivityInput) {

    try {
      await this.prisma.activityLog.create({
        data: {
          userId: input.session.sub,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          method: input.req?.method,
          path: input.req?.originalUrl ?? input.req?.url,
          ip: this.clientIp(input.req),
          userAgent: input.req?.get("user-agent"),
          metadata: input.metadata
        }
      });
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : "Cannot write activity log");
    }
  }

  private clientIp(req?: Request) {
    const forwarded = req?.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || req?.ip;
  }
}

