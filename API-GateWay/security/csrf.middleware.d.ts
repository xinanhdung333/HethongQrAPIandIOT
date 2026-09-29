import { NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
export declare class CsrfMiddleware implements NestMiddleware {
    use(request: Request, response: Response, next: NextFunction): void;
}
