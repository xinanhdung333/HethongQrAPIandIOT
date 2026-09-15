import { Injectable, NestMiddleware } from "@nestjs/common";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "./prisma.service";

@Injectable()
export class ApiAuditMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  use(req: Request & { apiKey?: { id: string; userId: string; rentalId: string | null; isTest: boolean }; apiError?: string }, res: Response, next: NextFunction) {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", requestId);
    const path = req.originalUrl.split("?")[0];
    if (!path.startsWith("/api/v1/qr-codes") && !path.startsWith("/api/v1/tickets")) return next();
    let logged = false;
    const record = () => {
      if (logged) return;
      logged = true;
      void this.prisma.apiRequestLog.create({ data: {
        requestId, userId: req.apiKey?.userId, apiKeyId: req.apiKey?.id, rentalId: req.apiKey?.rentalId,
        method: req.method, endpoint: path, statusCode: res.writableFinished ? res.statusCode : 499,
        durationMs: Date.now() - started, ip: req.ip, isTest: req.apiKey?.isTest ?? false, error: req.apiError
      } }).catch(() => console.error("API audit persistence failed", requestId));
    };
    res.once("finish", record);
    res.once("close", record);
    next();
  }
}
