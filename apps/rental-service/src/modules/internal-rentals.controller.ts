import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, UnauthorizedException } from "@nestjs/common";
import { RentalQuotaService } from "../services/rental-quota.service";

class QuotaDto {
  amount?: number;
}

@Controller("internal/rentals")
export class InternalRentalsController {
  constructor(private readonly quota: RentalQuotaService) {}

  @Post(":id/consume-quota")
  @HttpCode(HttpStatus.OK)
  consume(@Param("id") id: string, @Body() body: QuotaDto, @Headers("x-internal-service-token") token?: string) {
    this.assertToken(token);
    return this.quota.consume(id, body.amount ?? 1);
  }

  @Post(":id/refund-quota")
  @HttpCode(HttpStatus.OK)
  refund(@Param("id") id: string, @Body() body: QuotaDto, @Headers("x-internal-service-token") token?: string) {
    this.assertToken(token);
    return this.quota.refund(id, body.amount ?? 1);
  }

  private assertToken(token?: string) {
    if (!token || token !== (process.env.INTERNAL_SERVICE_TOKEN ?? "")) {
      throw new UnauthorizedException({ error: "internal_unauthorized", message: "Invalid internal service token" });
    }
  }
}
