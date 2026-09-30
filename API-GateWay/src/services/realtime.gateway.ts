import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: "*" } })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage("join")
  join(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
    client.join(room);
    return { joined: room };
  }

  emitTicketSold(showId: string, payload: unknown) {
    this.server?.to(`show_${showId}`).emit("show:ticket_sold", payload);
  }

  emitTicketVerified(customerId: string, payload: unknown) {
    this.server?.to(`customer_${customerId}`).emit("ticket:verified", payload);
  }
}
