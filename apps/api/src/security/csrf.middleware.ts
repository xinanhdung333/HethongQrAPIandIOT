import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";

// This is a low-cost defense for cookie-authenticated browser requests. API clients
// under /api/v1 use explicit bearer/API-key headers and stay exempt to avoid breaking SDKs.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_PREFIXES = ["/api/v1/", "/webhooks/", "/api/thanh-toan/"];

function readCookie(request: Request, name: string) {
  const header = request.headers.cookie ?? "";
  const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined;
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const requestPath = request.originalUrl.split("?")[0];
    if (SAFE_METHODS.has(request.method) || PUBLIC_PREFIXES.some((prefix) => request.path.startsWith(prefix) || requestPath.startsWith(prefix))) {
      next();
      return;
    }

    const cookieToken = readCookie(request, "csrf_token");
    const headerToken = request.header("x-csrf-token");
    if (!cookieToken || !headerToken) throw new ForbiddenException({ error: "csrf_required", message: "X-CSRF-Token is required" });
    const left = Buffer.from(cookieToken);
    const right = Buffer.from(headerToken);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new ForbiddenException({ error: "csrf_invalid", message: "X-CSRF-Token does not match csrf_token cookie" });
    }
    next();
  }
}
