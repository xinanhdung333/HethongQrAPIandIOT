import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiVerifyQrDto } from "../dto";
import { TicketVerificationService } from "../services/ticket-verification.service";

@Controller("api/v1/tickets")
export class TicketsController {
  constructor(private readonly ticketVerification: TicketVerificationService) {}

  @Post("verify")
  async verify(@Body() dto: ApiVerifyQrDto, @Headers("x-api-key") apiKey?: string) {
    return this.ticketVerification.verify(dto, apiKey);
  }
}
