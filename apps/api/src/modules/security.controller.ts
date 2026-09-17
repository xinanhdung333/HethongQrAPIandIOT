import { Controller, Get, Res } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Response } from "express";

@Controller("api")
export class SecurityController {
  @Get("csrf-token")
  csrfToken(@Res({ passthrough: true }) response: Response) {
    const token = randomBytes(32).toString("hex");
    response.cookie("csrf_token", token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    return { token };
  }
}
