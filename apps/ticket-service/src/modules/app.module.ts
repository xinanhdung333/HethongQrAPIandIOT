import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../services/prisma.service";
import { TicketVerificationService } from "../services/ticket-verification.service";
import { TicketsController } from "./tickets.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../api/.env", ".env"] })],
  controllers: [TicketsController],
  providers: [PrismaService, TicketVerificationService]
})
export class AppModule {}
