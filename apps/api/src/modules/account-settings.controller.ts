import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Res, UnauthorizedException } from "@nestjs/common";
import { Response } from "express";
import { AvatarUploadDto, PasswordDto, PayoutAccountDto } from "../settings-payment.dto";
import { AuthService } from "../security/auth.service";
import { AccountSettingsService } from "../services/account-settings.service";

@Controller("api/v1/account")
export class AccountSettingsController {
  constructor(private readonly auth: AuthService, private readonly account: AccountSettingsService) {}

  @Get("settings")
  async settings(@Headers("authorization") authorization?: string) {
    const session = await this.session(authorization);
    return this.account.profile(session);
  }

  @Post("avatar")
  async avatar(@Body() dto: AvatarUploadDto, @Headers("authorization") authorization?: string) {
    const session = await this.session(authorization);
    return this.account.uploadAvatar(session, dto);
  }

  @Post("payout-accounts")
  async createPayout(@Body() dto: PayoutAccountDto, @Headers("authorization") authorization?: string) {
    const session = await this.session(authorization);
    return this.account.createPayoutAccount(session, dto);
  }

  @Patch("payout-accounts/:id")
  async updatePayout(@Param("id") id: string, @Body() dto: Partial<PayoutAccountDto>, @Headers("authorization") authorization?: string) {
    const session = await this.session(authorization);
    return this.account.updatePayoutAccount(session, id, dto);
  }

  @Post("payout-accounts/:id/default")
  async makeDefault(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    const session = await this.session(authorization);
    return this.account.setDefault(session, id);
  }

  @Post("payout-accounts/:id/reveal")
  async reveal(@Param("id") id: string, @Body() dto: PasswordDto, @Headers("authorization") authorization?: string) {
    const session = await this.session(authorization);
    return this.account.revealPayoutAccount(session, id, dto.password);
  }

  @Delete("payout-accounts/:id")
  async remove(@Param("id") id: string, @Headers("authorization") authorization?: string, @Res({ passthrough: true }) res?: Response) {
    const session = await this.session(authorization);
    const result = await this.account.deletePayoutAccount(session, id);
    res?.status(200);
    return result;
  }

  private async session(authorization?: string) {
    const session = await this.auth.sessionFromAuthorization(authorization);
    if (!session) throw new UnauthorizedException({ error: "unauthorized", message: "Login required" });
    return session;
  }
}
