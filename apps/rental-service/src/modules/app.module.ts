import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../services/prisma.service";
import { RentalQuotaService } from "../services/rental-quota.service";
import { RentalQueryService } from "../services/rental-query.service";
import { ApiRentalsController } from "./api-rentals.controller";
import { InternalRentalsController } from "./internal-rentals.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../api/.env", ".env"] })],
  controllers: [ApiRentalsController, InternalRentalsController],
  providers: [PrismaService, RentalQuotaService, RentalQueryService]
})
export class AppModule {}
