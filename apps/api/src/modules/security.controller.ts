import { Controller, Get, Req, Res } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Request, Response } from "express";

@Controller("api")
export class SecurityController {
  @Get("csrf-token")
  csrfToken(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawExisting = request.headers.cookie?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("csrf_token="))
      ?.slice("csrf_token=".length);
    const existing = rawExisting ? decodeCookie(rawExisting) : undefined;
    const token = existing && /^[a-f0-9]{64}$/i.test(existing)
      ? existing
      : randomBytes(32).toString("hex");
    if (token !== existing) response.cookie("csrf_token", token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    return { token };
  }
}

function decodeCookie(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
