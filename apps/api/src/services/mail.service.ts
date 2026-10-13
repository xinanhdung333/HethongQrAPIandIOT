import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";

@Injectable()
export class MailService {
  private transport() {
    const host = process.env.SMARTQR_SMTP_HOST ?? process.env.SMTP_HOST ?? process.env.MAIL_HOST;
    const port = Number(process.env.SMARTQR_SMTP_PORT ?? process.env.SMTP_PORT ?? process.env.MAIL_PORT ?? 587);
    const user = process.env.SMARTQR_SMTP_USER ?? process.env.SMTP_USER ?? process.env.MAIL_USERNAME;
    const pass = process.env.SMARTQR_SMTP_PASS ?? process.env.SMTP_PASS ?? process.env.MAIL_PASSWORD;
    const encryption = process.env.MAIL_ENCRYPTION ?? "tls";
    if (!host || !user || !pass) throw new Error("smtp_not_configured");
    return nodemailer.createTransport({ host, port, secure: encryption === "ssl" || encryption === "smtps", requireTLS: encryption === "tls", auth: { user, pass } });
  }

  private from() {
    const address = process.env.SMARTQR_SMTP_FROM ?? process.env.SMTP_FROM ?? process.env.MAIL_FROM_ADDRESS ?? process.env.MAIL_USERNAME;
    const name = process.env.MAIL_FROM_NAME?.trim();
    return name ? `"${name}" <${address}>` : address;
  }

  async sendPasswordResetEmail(email: string, token: string, otp: string) {
    const webOrigin = (process.env.WEB_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
    const link = `${webOrigin}/dat-lai-mat-khau?token=${encodeURIComponent(token)}`;
    await this.safeSend({
      from: this.from(),
      to: email,
      subject: "[SmartQR] Khôi phục mật khẩu",
      text: `Bạn đã yêu cầu đặt lại mật khẩu SmartQR.\n\nMở liên kết: ${link}\n\nMã xác thực: ${otp}\nLiên kết và mã có hiệu lực trong 15 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html: `<p>Bạn đã yêu cầu đặt lại mật khẩu SmartQR.</p><p><a href="${link}">Đặt lại mật khẩu</a></p><p>Mã xác thực: <strong>${otp}</strong></p><p>Liên kết và mã có hiệu lực trong 15 phút.</p>`
    });
  }

  async sendPasswordChangedSuccessEmail(email: string) {
    await this.safeSend({ from: this.from(), to: email, subject: "[SmartQR] Mật khẩu đã được cập nhật", text: "Mật khẩu SmartQR của bạn đã được cập nhật. Nếu không phải bạn, hãy liên hệ quản trị viên ngay." });
  }

  async sendOrderCreatedEmail(data: { email: string; orderId: string; orderType: string; productName: string; quantity: number; duration?: number; depositAmount?: number; total: number; paymentUrl: string; shippingAddress?: Record<string, unknown> }) {
    await this.sendText(data.email, "[SmartQR] Đơn hàng đã được tạo", `Đơn hàng ${data.orderId} (${data.orderType}) đã được tạo cho sản phẩm ${data.productName}. Tổng tiền: ${data.total}. Thanh toán: ${data.paymentUrl}`);
  }

  async sendOrderPaidEmail(data: { email: string; orderId: string; orderType: string; productName: string; quantity: number; total: number; gateIds?: string[] }) {
    await this.sendText(data.email, "[SmartQR] Thanh toán thành công", `Đơn hàng ${data.orderId} đã thanh toán thành công. Sản phẩm: ${data.productName}. Tổng tiền: ${data.total}.`);
  }

  async sendApiRentalPaidEmail(data: { email: string; appName: string; plan: string; quota: number; total: number; apiKeyPrefix?: string }) {
    await this.sendText(data.email, "[SmartQR] Gói API đã được kích hoạt", `Ứng dụng ${data.appName} đã kích hoạt gói ${data.plan}. Hạn mức: ${data.quota}. Tổng tiền: ${data.total}.`);
  }

  async sendTicketOrderPaidEmail(data: { buyerEmail: string; buyerName?: string | null; showName: string; quantity: number; totalAmount: number; orderId: string }) {
    await this.sendText(data.buyerEmail, "[SmartQR] Vé đã được thanh toán", `Đơn vé ${data.orderId} cho sự kiện ${data.showName} đã thanh toán thành công. Số lượng: ${data.quantity}.`);
  }

  private async sendText(to: string, subject: string, text: string) {
    await this.safeSend({ from: this.from(), to, subject, text });
  }

  private async safeSend(message: SendMailOptions) {
    try {
      await this.transport().sendMail(message);
    } catch (error) {
      console.error("[MailService] Email delivery failed; API remains available:", error instanceof Error ? error.message : error);
    }
  }
}
