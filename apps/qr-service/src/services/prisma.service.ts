import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private connected = false;

  get isConnected() {
    return this.connected;
  }

  async onModuleInit() {
    await this.$connect();
    this.connected = true;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
