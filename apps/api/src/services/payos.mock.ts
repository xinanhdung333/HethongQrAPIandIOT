import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import crypto from "crypto";

export type PaymentMethod = "payos_demo" | "momo";
type PaymentKind = "rental" | "ticket" | "api";
type PaymentLinkInput = { orderId: string; amount: number; kind: PaymentKind; method?: PaymentMethod; stage?: "initial" | "remaining"; gatewayOrderId?: string };
type VietQrBank = { bin: string; name: string; shortName: string; code: string };

let vietQrBanks: Promise<VietQrBank[]> | null = null;

@Injectable()
export class PayosMockService {
  async createVietQrImage(input: { bankName: string; accountNumber: string; accountName: string; amount: number; orderId: string }) {
    const accountNumber = input.accountNumber.trim();
    const accountName = input.accountName.trim();
    if (!/^\d{6,30}$/.test(accountNumber) || !Number.isSafeInteger(input.amount) || input.amount < 1) {
      throw new BadRequestException({ error: "invalid_vietqr_details", message: "Thông tin ngân hàng hoặc số tiền không hợp lệ để tạo mã VietQR." });
    }
    const bank = await this.findVietQrBank(input.bankName);
    if (!/^\d{6}$/.test(bank.bin)) {
      throw new BadGatewayException({ error: "invalid_vietqr_bank_code", message: "Mã ngân hàng từ VietQR không hợp lệ." });
    }
    const imageUrl = new URL(`https://img.vietqr.io/image/${bank.bin}-${accountNumber}-compact2.png`);
    imageUrl.searchParams.set("amount", String(input.amount));
    imageUrl.searchParams.set("addInfo", input.orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-25));
    if (accountName) imageUrl.searchParams.set("accountName", accountName);

    let response: Response;
    try {
      response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error" });
    } catch {
      throw new BadGatewayException({ error: "vietqr_unavailable", message: "Không kết nối được dịch vụ tạo mã VietQR." });
    }
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("image/png")) {
      throw new BadGatewayException({ error: "vietqr_generation_failed", message: "Dịch vụ VietQR không tạo được mã thanh toán." });
    }
    if (Number(response.headers.get("content-length")) > 1024 * 1024) {
      throw new BadGatewayException({ error: "vietqr_image_too_large", message: "Ảnh mã VietQR vượt quá giới hạn cho phép." });
    }

    const image = Buffer.from(await response.arrayBuffer());
    if (image.length > 1024 * 1024) {
      throw new BadGatewayException({ error: "vietqr_image_too_large", message: "Ảnh mã VietQR vượt quá giới hạn cho phép." });
    }
    return image;
  }

  async createPaymentLink(input: PaymentLinkInput) {
    if (input.method === "momo") return this.createMomoPaymentLink(input);
    return this.createPayosDemoLink(input);
  }

  private createPayosDemoLink(input: PaymentLinkInput) {
    const baseUrl = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    const expires = Math.floor(Date.now() / 1000) + 30 * 60;
    const secret = process.env.PAYMENT_LINK_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "payment-link-dev-secret");
    if (!secret) throw new Error("PAYMENT_LINK_SECRET is required");
    const stage = input.stage ?? "initial";
    const signature = crypto.createHmac("sha256", secret).update(`${input.orderId}.${input.kind}.${stage}.${expires}`).digest("hex");
    const query = `order_id=${encodeURIComponent(input.orderId)}&kind=${input.kind}&payment_stage=${stage}&expires=${expires}&signature=${signature}`;
    return {
      paymentId: `payos_demo_${input.orderId}`,
      paymentUrl: `${baseUrl}/thanh-toan-demo?${query}`,
      checkoutUrl: `${baseUrl}/thanh-toan-demo?${query}`
    };
  }

  private async findVietQrBank(bankName: string) {
    if (!vietQrBanks) {
      vietQrBanks = fetch("https://api.vietqr.io/v2/banks", { signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error" })
        .then(async response => {
          if (!response.ok) throw new Error("VietQR bank directory request failed");
          const body = await response.json() as { code?: string; data?: VietQrBank[] };
          if (body.code !== "00" || !Array.isArray(body.data)) throw new Error("VietQR bank directory response is invalid");
          return body.data;
        })
        .catch(error => {
          vietQrBanks = null;
          throw new BadGatewayException({ error: "vietqr_bank_lookup_failed", message: error instanceof Error ? error.message : "Không tra cứu được mã ngân hàng VietQR." });
        });
    }

    const banks = await vietQrBanks;
    const normalizedName = normalizeBankName(bankName);
    const bank = banks.find(item => [item.bin, item.code, item.shortName, item.name].some(value => normalizeBankName(value) === normalizedName));
    if (!bank) {
      throw new BadRequestException({ error: "unsupported_payout_bank", message: `Không tìm thấy mã VietQR cho ngân hàng "${bankName}". Hãy cập nhật tên ngân hàng bằng tên hoặc mã ngân hàng hợp lệ trong Payout.` });
    }
    return bank;
  }

  private async createMomoPaymentLink(input: PaymentLinkInput) {
    const partnerCode = process.env.MOMO_PARTNER_CODE?.trim() || "MOMO";
    const accessKey = process.env.MOMO_ACCESS_KEY?.trim() || "F8BBA842ECF85";
    const secretKey = process.env.MOMO_SECRET_KEY?.trim() || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    const endpoint = process.env.MOMO_ENDPOINT?.trim() || "https://test-payment.momo.vn/v2/gateway/api/create";
    const baseUrl = process.env.WEB_ORIGIN?.trim() || "http://localhost:3000";
    const apiUrl = process.env.API_PUBLIC_URL?.trim() || `http://localhost:${process.env.PORT ?? 4000}`;
    const gatewayOrderId = input.gatewayOrderId ?? input.orderId;
    const requestId = `${partnerCode}${Date.now()}`;
    const orderInfo = `SmartQR ${input.kind} ${input.orderId}`;
    const redirectUrl = `${baseUrl}/thanh-toan-demo?order_id=${encodeURIComponent(input.orderId)}&kind=${input.kind}&gateway=momo`;
    const ipnUrl = process.env.MOMO_IPN_URL?.trim() || `${apiUrl}/webhooks/momo`;
    const requestType = "payWithATM";
    const extraData = "";
    const amount = String(Math.max(1000, Math.round(input.amount)));
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${gatewayOrderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerCode,
        accessKey,
        requestId,
        amount,
        orderId: gatewayOrderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature,
        lang: "vi"
      }),
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.json().catch(() => null) as { payUrl?: string; deeplink?: string; resultCode?: number; message?: string } | null;
    if (!response.ok || !body?.payUrl) {
      throw new BadRequestException({ error: "momo_payment_failed", message: body?.message ?? "MoMo sandbox did not return a payment URL" });
    }

    return {
      paymentId: `momo_${input.orderId}`,
      paymentUrl: body.payUrl,
      checkoutUrl: body.payUrl
    };
  }
}

function normalizeBankName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}
