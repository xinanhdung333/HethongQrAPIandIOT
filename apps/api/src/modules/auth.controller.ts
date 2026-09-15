import { Body, Controller, Get, Headers, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { LoginDto, RegisterDto, UpdateProfileDto } from "../dto";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly platform: PlatformService, private readonly activity: ActivityLogService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.platform.register(dto);
    await this.activity.record({ session: { sub: result.user.id, email: result.user.email, role: result.user.role, jti: "" }, action: "REGISTER", targetType: "User", targetId: result.user.id, req });
    return result;
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.platform.login(dto);
    await this.activity.record({ session: { sub: result.user.id, email: result.user.email, role: result.user.role, jti: "" }, action: "LOGIN", targetType: "User", targetId: result.user.id, req });
    return result;
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Missing token");
    return this.platform.me(token);
  }

  @Patch("profile")
  async updateProfile(@Body() dto: UpdateProfileDto, @Headers("authorization") authorization?: string, @Req() req?: Request) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Missing token");
    const session = await this.platform.me(token).then((value) => ({ sub: value.user.id, email: value.user.email, role: value.user.role, jti: "" }));
    const result = await this.platform.updateProfile(session.sub, dto);
    await this.activity.record({ session, action: "UPDATE_PROFILE", targetType: "User", targetId: session.sub, metadata: { email_changed: Boolean(dto.email) }, req });
    return result;
  }

  @Post("logout")
  async logout(@Headers("authorization") authorization?: string, @Req() req?: Request) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Missing token");
    const session = await this.platform.me(token).then((value) => ({ sub: value.user.id, email: value.user.email, role: value.user.role, jti: "" }));
    const result = await this.platform.logout(token);
    await this.activity.record({ session, action: "LOGOUT", targetType: "User", targetId: session.sub, req });
    return result;
  }
}
