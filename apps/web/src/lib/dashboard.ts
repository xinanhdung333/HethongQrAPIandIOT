import { api } from "./api";

export type DashboardTicketOrder = {
  id: string;
  status: string;
  quantity: number;
  totalAmount: number;
  payoutAmount: number;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string | null;
  buyerNote?: string | null;
  createdAt?: string;
  show: { name: string; id: string; slug?: string; startAt?: string; location?: string; totalTickets?: number; soldTickets?: number; ticketPrice?: number };
  tickets: Array<{ id: string; qrJwt?: string; qrOfflineJwt?: string | null; isUsed: boolean }>;
};

export type DashboardPurchasedTicketOrder = Omit<DashboardTicketOrder, "tickets"> & {
  tickets: Array<{ id: string; qrJwt: string; qrOfflineJwt?: string | null; isUsed: boolean }>;
};

export type DashboardData = {
  rentals: Array<{
    id: string;
    type?: "BUY" | "RENT";
    status: string;
    total: number;
    quantity: number;
    duration?: number;
    startDate?: string;
    paymentDueAt?: string;
    depositAmount?: number;
    remainingAmount?: number;
    remainingPaidAmount?: number;
    remainingPaymentStatus?: "NOT_REQUIRED" | "PENDING" | "PAID";
    gateIds?: string[];
    createdAt?: string;
    product?: { name: string; type?: "IOT_MINI" | "IOT_PRO" | "COMPONENT" };
  }>;
  apiRentals: Array<{ id: string; appName: string; website?: string | null; callbackUrl?: string | null; plan: string; duration: number; quota: number; scopes?: string[]; total: number; status: string; apiKeyPrefix?: string | null; signingEnabled?: boolean; billingMode?: string; createUnitPrice?: number; verifyUnitPrice?: number; createdAt?: string }>;
  shows: Array<{ id: string; slug: string; name: string; status?: string; installationStatus?: string; scannerCount?: number; installationNote?: string | null; soldTickets: number; totalTickets: number; ticketPrice: number; location?: string; startAt?: string; createdAt?: string }>;
  apiKeys: Array<{ id: string; prefix: string; quota: number; scopes?: string[]; rentalId?: string | null; showId?: string | null; status?: string; isTest?: boolean; allowedIps?: string[]; rateLimit?: number; revokeAt?: string | null; createdAt?: string }>;
  ticketOrders: DashboardTicketOrder[];
  purchasedTicketOrders: DashboardPurchasedTicketOrder[];
  payouts: Array<{ id: string; amount: number; status: string }>;
  tickets: Array<{ id: string; isUsed: boolean; hasOfflineQr?: boolean; show: { name: string } }>;
  externalQrCodes: Array<{
    id: string;
    code: string;
    qrJwt: string;
    resourceType: string;
    resourceId: string;
    customerRef?: string | null;
    isUsed: boolean;
    expiresAt: string;
    createdAt?: string;
    scanLogs?: Array<{ id: string; gateId: string; valid: boolean; reason?: string | null; ip?: string | null; createdAt: string }>;
  }>;
};

export function getDashboard() {
  return api<DashboardData>("/dashboard", { cache: "no-store" }).catch(() => ({
    rentals: [],
    apiRentals: [],
    shows: [],
    apiKeys: [],
    ticketOrders: [],
    purchasedTicketOrders: [],
    payouts: [],
    tickets: [],
    externalQrCodes: []
  }));
}
