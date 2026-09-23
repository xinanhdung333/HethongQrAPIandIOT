import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../services/prisma.service";
import { RedisService } from "../services/redis.service";
import { AuthService } from "../security/auth.service";
import { QrPlatformService } from "../services/qr-platform.service";
import { WebhookDeliveryService } from "../services/webhook-delivery.service";
import { SystemSettingsService } from "../services/system-settings.service";
import { QrCodesController } from "./qr-codes.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../api/.env", ".env"] })],
  controllers: [QrCodesController],
  providers: [PrismaService, RedisService, AuthService, QrPlatformService, WebhookDeliveryService, SystemSettingsService]
})
export class AppModule {}
