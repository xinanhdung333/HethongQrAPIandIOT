import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ApiVerifyQrDto } from "../dto";
import { PrismaService } from "./prisma.service";

type ApiKeyRecord = { id: string; userId: string; showId?: string | null; scopes: unknown; status?: string; isTest?: boolean };

@Injectable()
export class TicketVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(dto: ApiVerifyQrDto, apiKey?: string) {
    if (!apiKey) {
      throw new UnauthorizedException({ error: "unauthorized", message: "Missing API key" });
    }
    const key = await this.assertApiKey(apiKey);
    if (!dto.qr_jwt && !dto.ticket_code) {
      throw new BadRequestException({ error: "missing_qr", message: "qr_jwt or ticket_code is required" });
    }
    if (!dto.gate_id?.trim()) {
      throw new BadRequestException({ error: "missing_gate", message: "gate_id is required" });
    }

    const token = dto.qr_jwt ?? dto.ticket_code!;

    if (dto.ticket_code && !dto.ticket_code.includes(".")) {
      const external = await this.prisma.externalQrCode.findUnique({ where: { code: dto.ticket_code }, include: { apiKey: true } });
      if (!external) {
        throw new UnauthorizedException({ error: "code_not_found", message: "Code not found" });
      }
      if (key && external.userId !== key.userId) {
        throw new UnauthorizedException({ error: "forbidden", message: "API key cannot verify this QR code" });
      }
      if (external.revokedAt || external.expiresAt.getTime() < Date.now()) {
        return { valid: false, reason: external.revokedAt ? "QR code revoked" : "QR code expired" };
      }
      if (external.isUsed) {
        return { valid: false, reason: "QR code already used" };
      }
      return this.verifyToken(external.qrJwt, dto.gate_id, key);
    }

    return this.verifyToken(token, dto.gate_id, key);
  }

  private async verifyToken(token: string, gateId: string, key: ApiKeyRecord | null) {
    const decoded = this.verifyQrJwt<{ jti: string; type?: string; buyer?: string; show_id?: string; resource_type?: string; resource_id?: string; customer_ref?: string }>(token);

    if (decoded.type === "external_qr") {
      const external = await this.prisma.externalQrCode.findFirst({ where: { qrJwt: token }, include: { apiKey: true } });
      if (!external || external.jti !== decoded.jti) {
        throw new UnauthorizedException({ error: "qr_not_found", message: "QR code not found" });
      }
      if (key && external.userId !== key.userId) {
        throw new UnauthorizedException({ error: "forbidden", message: "API key cannot verify this QR code" });
      }
      if (external.revokedAt) return { valid: false, reason: "QR code revoked" };
      if (external.expiresAt.getTime() < Date.now()) return { valid: false, reason: "QR code expired" };
      if (external.isUsed) return { valid: false, reason: "QR code already used" };
      const now = new Date();
      const marked = await this.prisma.externalQrCode.updateMany({
        where: { id: external.id, isUsed: false },
        data: { isUsed: true, usedAt: now, useCount: { increment: 1 } }
      });
      if (!marked.count) return { valid: false, reason: "QR code already used" };
      return {
        valid: true,
        type: "external_qr",
        qr_id: external.id,
        gate_id: gateId,
        resource_type: external.resourceType,
        resource_id: external.resourceId,
        customer_ref: external.customerRef,
        payload: external.payload
      };
    }

    const ticket = await this.prisma.ticket.findFirst({ where: { qrJwt: token }, include: { show: true } });
    if (!ticket || ticket.jti !== decoded.jti) {
      throw new UnauthorizedException({ error: "ticket_not_found", message: "Ticket not found" });
    }
    if (key && key.showId && key.showId !== ticket.showId) {
      throw new ForbiddenException({ error: "show_key_mismatch", message: "This scanner key is not authorized for this show" });
    }
    if (ticket.isUsed) return { valid: false, reason: "Ticket already used" };
    const now = new Date();
    const marked = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, isUsed: false },
      data: { isUsed: true, usedAt: now, useCount: { increment: 1 } }
    });
    if (!marked.count) return { valid: false, reason: "Ticket already used" };
    return { valid: true, ticket_id: ticket.id, show_id: ticket.showId, gate_id: gateId, buyer: decoded.buyer };
  }

  private verifyQrJwt<T extends { jti: string }>(token: string): T {
    for (const secret of this.qrSecrets()) {
      try {
        return jwt.verify(token, secret) as T;
      } catch {
        // Try the next configured legacy secret before rejecting the QR.
      }
    }
    throw new UnauthorizedException({ error: "invalid_qr", message: "Invalid QR signature" });
  }

  private qrSecrets() {
    return Array.from(new Set([
      process.env.QR_JWT_SECRET,
      process.env.JWT_SECRET,
      "smartqr-local-dev-secret-change-in-production",
      "dev-secret"
    ].filter(Boolean) as string[]));
  }

  private async assertApiKey(raw: string) {
    const pepper = process.env.API_KEY_PEPPER ?? "local-development-api-key-pepper";
    const keyHash = crypto.createHmac("sha256", pepper).update(raw).digest("hex");
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash }, include: { rental: true } });
    if (!key) {
      throw new UnauthorizedException({ error: "unauthorized", message: "Invalid API key" });
    }
    if (key.status !== "active") {
      throw new ForbiddenException({ error: "forbidden", message: "API key is not active" });
    }
    const scopes = Array.isArray(key.scopes) ? key.scopes : [];
    if (!scopes.includes("ticket:verify")) {
      throw new ForbiddenException({ error: "forbidden_scope", message: "API key does not have 'ticket:verify' permission" });
    }
    return key as ApiKeyRecord;
  }
}
