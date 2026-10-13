const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

process.env.DATABASE_URL = "postgresql://smartqr:1@localhost:5432/smartqr?schema=public";
const prisma = new PrismaClient();
const secret = "qr-jwt-dev-secret";
const rawKey = "sk_test_scan_demo_2026";
const pepper = "local-development-api-key-pepper";
const keyHash = crypto.createHmac("sha256", pepper).update(rawKey).digest("hex");

(async () => {
  const user = await prisma.user.upsert({
    where: { email: "scan-demo@smartqr.vn" },
    update: {},
    create: { email: "scan-demo@smartqr.vn", passwordHash: "demo-only", fullName: "SmartQR Scan Demo" }
  });
  const requestedShow = process.env.TARGET_SHOW_SLUG ? await prisma.show.findUnique({ where: { slug: process.env.TARGET_SHOW_SLUG } }) : null;
  const show = requestedShow ? await prisma.show.update({
    where: { id: requestedShow.id },
    data: { startAt: new Date(Date.now() + 14 * 86400000), endAt: new Date(Date.now() + 15 * 86400000) }
  }) : await prisma.show.upsert({
    where: { slug: "scan-demo-2026" },
    update: {},
    create: {
      ownerId: user.id, slug: "scan-demo-2026", name: "SmartQR Scan Demo", description: "Dữ liệu test quét QR",
      bannerUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
      themeColor: "#18181b", location: "Local test", startAt: new Date(Date.now() + 86400000), ticketPrice: 0,
      totalTickets: 10, payoutAccount: { bank: "DEMO", account: "000000", name: "SMARTQR" }
    }
  });
  await prisma.apiKey.upsert({
    where: { keyHash }, update: { status: "active", showId: show.id, scopes: ["ticket:verify"] },
    create: { userId: user.id, showId: show.id, keyHash, prefix: rawKey.slice(0, 20), scopes: ["ticket:verify"], quota: 100, rateLimit: 60 }
  });
  const jti = "scan-demo-" + crypto.randomBytes(8).toString("hex");
  const token = jwt.sign({ sub: "ticket:scan-demo", show_id: show.id, buyer: "scan-demo@smartqr.vn", type: "ticket", jti }, secret, { expiresIn: "1h" });
  const order = await prisma.ticketOrder.create({ data: { showId: show.id, buyerName: "Scan Demo", buyerEmail: "scan-demo@smartqr.vn", quantity: 1, totalAmount: 0, platformFee: 0, payoutAmount: 0, status: "PAID" } });
  const ticket = await prisma.ticket.create({ data: { showId: show.id, ticketOrderId: order.id, jti, qrJwt: token } });
  console.log(JSON.stringify({ show: show.name, ticketId: ticket.id, qrJwt: token, apiKey: rawKey, gateId: "gate-main" }, null, 2));
})().finally(() => prisma.$disconnect());
