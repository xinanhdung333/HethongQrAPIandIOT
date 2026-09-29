"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsrfMiddleware = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
// This is a low-cost defense for cookie-authenticated browser requests. API clients
// under /api/v1 use explicit bearer/API-key headers and stay exempt to avoid breaking SDKs.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_PREFIXES = ["/api/v1/", "/webhooks/", "/api/thanh-toan/"];
function readCookie(request, name) {
    const header = request.headers.cookie ?? "";
    const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined;
}
let CsrfMiddleware = class CsrfMiddleware {
    use(request, response, next) {
        const requestPath = request.originalUrl.split("?")[0];
        if (SAFE_METHODS.has(request.method) || PUBLIC_PREFIXES.some((prefix) => request.path.startsWith(prefix) || requestPath.startsWith(prefix))) {
            next();
            return;
        }
        const cookieToken = readCookie(request, "csrf_token");
        const headerToken = request.header("x-csrf-token");
        if (!cookieToken || !headerToken)
            throw new common_1.ForbiddenException({ error: "csrf_required", message: "X-CSRF-Token is required" });
        const left = Buffer.from(cookieToken);
        const right = Buffer.from(headerToken);
        if (left.length !== right.length || !(0, crypto_1.timingSafeEqual)(left, right)) {
            throw new common_1.ForbiddenException({ error: "csrf_invalid", message: "X-CSRF-Token does not match csrf_token cookie" });
        }
        next();
    }
};
exports.CsrfMiddleware = CsrfMiddleware;
exports.CsrfMiddleware = CsrfMiddleware = __decorate([
    (0, common_1.Injectable)()
], CsrfMiddleware);
