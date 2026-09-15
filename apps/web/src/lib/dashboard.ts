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
  tickets: Array<{ id: string; qrJwt: string; isUsed: boolean }>;
};

export type DashboardData = {
  rentals: Array<{ id: string; status: string; total: number; quantity: number; duration?: number; gateIds?: string[]; createdAt?: string; product?: { name: string } }>;
  apiRentals: Array<{ id: string; appName: string; website?: string | null; callbackUrl?: string | null; plan: string; duration: number; quota: number; scopes?: string[]; total: number; status: string; apiKeyPrefix?: string | null; signingEnabled?: boolean; billingMode?: string; createUnitPrice?: number; verifyUnitPrice?: number; createdAt?: string }>;
  shows: Array<{ id: string; slug: string; name: string; status?: string; soldTickets: number; totalTickets: number; ticketPrice: number; location?: string; startAt?: string; createdAt?: string }>;
  apiKeys: Array<{ id: string; prefix: string; quota: number; scopes?: string[]; rentalId?: string | null; status?: string; isTest?: boolean; allowedIps?: string[]; rateLimit?: number; revokeAt?: string | null; createdAt?: string }>;
  ticketOrders: DashboardTicketOrder[];
  purchasedTicketOrders: DashboardTicketOrder[];
  payouts: Array<{ id: string; amount: number; status: string }>;
  tickets: Array<{ id: string; qrJwt: string; isUsed: boolean; show: { name: string } }>;
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
