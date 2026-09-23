import { Body, Controller, Get, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { RentalQueryService } from "../services/rental-query.service";

@Controller("api-rentals")
export class ApiRentalsController {
  constructor(private readonly rentals: RentalQueryService) {}

  @Get()
  list(@Headers("x-user-id") userId?: string) {
    if (!userId) throw new UnauthorizedException("Login required");
    return this.rentals.list(userId);
  }

  @Post()
  create(@Headers("x-user-id") userId: string | undefined, @Body() body: {
    app_name?: string;
    website?: string;
    callback_url?: string;
    plan?: "starter" | "business";
    duration?: number;
    scopes?: string[];
  }) {
    if (!userId) throw new UnauthorizedException("Login required");
    return this.rentals.create(userId, body);
  }
}
