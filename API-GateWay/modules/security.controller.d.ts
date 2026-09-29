import { Request, Response } from "express";
export declare class SecurityController {
    csrfToken(request: Request, response: Response): {
        token: string;
    };
}
