import { PrismaClient, ProductType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo123456", 12);
  const adminPasswordHash = await bcrypt.hash("admin123456", 12);
  await prisma.user.upsert({
    where: { email: "admin@smartqr.vn" },
    update: { role: UserRole.ADMIN },
    create: { email: "admin@smartqr.vn", passwordHash: adminPasswordHash, role: UserRole.ADMIN }
  });

  const user = await prisma.user.upsert({
    where: { email: "demo@smartqr.vn" },
    update: {},
    create: { email: "demo@smartqr.vn", passwordHash, role: UserRole.CUSTOMER }
  });

  const products = [
    {
      slug: "sp-01-mini",
      name: "SP-01 Mini",
      type: ProductType.IOT_MINI,
      priceSell: 3900000,
      priceRentMonth: 690000,
      depositFee: 2000000,
      stock: 25,
      images: ["/products/sp-01.svg"],
      specs: { scanner: "GM65 UART", controller: "ESP32", display: "OLED", relay: "Servo SG90" }
    },
    {
      slug: "sp-02-pro",
      name: "SP-02 Pro",
      type: ProductType.IOT_PRO,
      priceSell: 12900000,
      priceRentMonth: 1990000,
      depositFee: 5000000,
      stock: 8,
      images: ["/products/sp-02.svg"],
      specs: { scanner: "Honeywell 1470g", controller: "Raspberry Pi 4", display: "HDMI 5 inch" }
    },
    ...["gm65", "esp32", "servo-sg90", "vo-hop", "oled"].map((slug, index) => ({
      slug,
      name: ["GM65 QR Scanner", "ESP32 DevKit V1", "Servo SG90", "Vỏ hộp SP-01", "OLED SSD1306"][index],
      type: ProductType.COMPONENT,
      priceSell: [690000, 180000, 90000, 250000, 120000][index],
      priceRentMonth: 0,
      depositFee: 0,
      stock: [80, 120, 100, 40, 100][index],
      images: ["/products/component.svg"],
      specs: { warranty: "3 tháng", service: "Lắp đặt theo yêu cầu" }
    }))
  ];

  for (const product of products) {
    await prisma.product.upsert({ where: { slug: product.slug }, update: product, create: product });
  }

  await prisma.show.upsert({
    where: { slug: "dem-nhac-abc" },
    update: {},
    create: {
      ownerId: user.id,
      slug: "dem-nhac-abc",
      name: "Đêm Nhạc ABC",
      description: "Show demo white-label với QR ticket và PayOS mock.",
      bannerUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80",
      themeColor: "#18181b",
      location: "Nhà hát Hòa Bình, TP.HCM",
      startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      ticketPrice: 100000,
      totalTickets: 500,
      payoutAccount: { bank: "DEMO Bank", account: "0123456789", name: "SMARTQR DEMO" }
    }
  });

  const staticPages = [
    {
      slug: "home",
      navLabel: "Trang chủ",
      title: "SmartQR - cổng QR, vé điện tử và API kiểm soát ra vào",
      description: "Một nền tảng gọn để thuê hộp quét, bán vé show, tích hợp API verify và quản lý lượt quét realtime với chi phí dễ bắt đầu.",
      heroImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80",
      ctaPrimary: { label: "Xem dịch vụ", href: "/dich-vu" },
      ctaSecondary: { label: "Thuê API", href: "/thue-api" },
      sortOrder: 0,
      sections: [
        { kind: "cards", title: "Các gói nổi bật", subtitle: "Từ thiết bị đến phần mềm, tất cả đi theo một luồng QR thống nhất.", items: [
          { title: "Thuê hộp quét", body: "SP-01 Mini và SP-02 Pro đã cấu hình sẵn gate ID, phù hợp gym, lớp học, sự kiện nhỏ.", href: "/thue-thiet-bi" },
          { title: "Thuê API verify", body: "API xác thực JWT jti, chống quét lại, kết nối dễ với web hoặc app đang có.", href: "/thue-api" },
          { title: "Trang bán vé", body: "Tạo trang white-label cho show, bán vé demo PayOS và nhận dashboard realtime.", href: "/tao-show" }
        ] },
        { kind: "band", title: "Sinh ra để giúp đội nhỏ bán và soát vé nhanh hơn", body: "SmartQR bắt đầu từ nhu cầu dựng cổng kiểm soát vé giá hợp lý cho sự kiện địa phương. Thay vì mua hệ thống lớn, đội vận hành có thể thuê thiết bị, dùng API và quản lý tất cả trên web." },
        { kind: "stats", title: "Giá dễ thử, quy trình rõ", items: [
          { value: "690k", label: "từ mỗi tháng cho SP-01" },
          { value: "5%", label: "phí nền tảng show demo" },
          { value: "10 req/s", label: "rate limit verify mặc định" }
        ] }
      ]
    },
    {
      slug: "san-pham",
      navLabel: "Sản phẩm",
      title: "Thiết bị QR cho cổng vào, quầy check-in và sự kiện",
      description: "Giới thiệu SP-01 Mini, SP-02 Pro và linh kiện IoT. Admin có thể thay ảnh, câu chữ và các khối nội dung bất cứ lúc nào.",
      heroImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80",
      ctaPrimary: { label: "Xem hàng", href: "/linh-kien" },
      ctaSecondary: { label: "Thuê thiết bị", href: "/thue-thiet-bi" },
      sortOrder: 1,
      sections: [
        { kind: "cards", title: "Dòng sản phẩm", subtitle: "Tập trung vào vận hành thực tế, không phức tạp hóa phần cứng.", items: [
          { title: "SP-01 Mini", body: "Gọn, rẻ, đủ cho một cổng hoặc quầy check-in." },
          { title: "SP-02 Pro", body: "Mạnh hơn cho sự kiện lớn, vận hành liên tục." },
          { title: "Linh kiện", body: "GM65, ESP32, servo, vỏ hộp và màn hình để tự lắp." }
        ] },
        { kind: "band", title: "Ảnh và mô tả sản phẩm do admin quản lý", body: "Trang này là nội dung quảng cáo tĩnh, còn dữ liệu giá và kho vẫn lấy từ bảng products khi cần bán hoặc cho thuê." }
      ]
    },
    {
      slug: "dich-vu",
      navLabel: "Dịch vụ",
      title: "Dịch vụ QR trọn gói cho bán vé và kiểm soát ra vào",
      description: "Tư vấn, cấu hình, bàn giao API key, trang bán vé white-label và dashboard theo dõi realtime.",
      heroImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80",
      ctaPrimary: { label: "Xem bảng giá", href: "/bang-gia" },
      ctaSecondary: { label: "Tạo show", href: "/tao-show" },
      sortOrder: 2,
      sections: [
        { kind: "cards", title: "Bạn nhận được gì", items: [
          { title: "Khảo sát nhu cầu", body: "Chọn thiết bị và flow phù hợp với quy mô vận hành." },
          { title: "Cấu hình hệ thống", body: "Thiết lập gate, QR, JWT, API key và dashboard." },
          { title: "Hỗ trợ demo", body: "Có PayOS mock để chạy thử trước khi nối thanh toán thật." }
        ] },
        { kind: "band", title: "Phù hợp cho đơn vị muốn bắt đầu nhỏ", body: "Không cần mua trọn hệ thống đắt tiền. Bạn có thể thuê theo tháng, chạy thử quy trình và mở rộng khi lượng khách tăng." }
      ]
    },
    {
      slug: "thue-api",
      navLabel: "Thuê API",
      title: "Thuê API kiểm tra QR giá rẻ cho website có sẵn",
      description: "Dùng API verify để kiểm tra vé, thành viên hoặc quyền vào cổng. Phù hợp gym, lớp học, coworking và đơn vị tổ chức sự kiện.",
      heroImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1600&q=80",
      ctaPrimary: { label: "Thuê ngay", href: "/thue-thiet-bi" },
      ctaSecondary: { label: "Tài liệu API", href: "/docs" },
      sortOrder: 3,
      sections: [
        { kind: "cards", title: "Lý do nên thuê API", items: [
          { title: "Nhanh tích hợp", body: "Endpoint verify đơn giản, dùng X-API-KEY và payload QR JWT." },
          { title: "Chống quét lại", body: "Mỗi QR có jti, trạng thái được revoke sau lần quét đầu." },
          { title: "Chi phí thấp", body: "Bắt đầu bằng gói nhỏ, không cần tự xây backend realtime." }
        ] },
        { kind: "stats", title: "Thông số demo", items: [
          { value: "10 req/s", label: "rate limit mặc định" },
          { value: "SHA-256", label: "hash API key" },
          { value: "JWT jti", label: "chống replay" }
        ] }
      ]
    },
    {
      slug: "bang-gia",
      navLabel: "Giá rẻ",
      title: "Bảng giá dễ bắt đầu cho thiết bị, API và show",
      description: "Minh bạch phí thuê, cọc, lắp đặt và hoa hồng nền tảng để khách hàng ra quyết định nhanh.",
      heroImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80",
      ctaPrimary: { label: "Thuê thiết bị", href: "/thue-thiet-bi" },
      ctaSecondary: { label: "Tạo show", href: "/tao-show" },
      sortOrder: 4,
      sections: [
        { kind: "pricing", title: "Gói tham khảo", items: [
          { title: "SP-01 Mini", price: "690k/tháng", body: "Cọc 2tr, lắp đặt 300k." },
          { title: "SP-02 Pro", price: "1.99tr/tháng", body: "Cọc 5tr, phù hợp sự kiện lớn." },
          { title: "White-label Show", price: "199k + 5%", body: "Trang bán vé riêng và dashboard realtime." }
        ] },
        { kind: "band", title: "Giá rẻ nhưng không rẻ tiền", body: "SmartQR tối giản phần cần tối giản, còn bảo mật QR, API key hash và realtime vẫn giữ đúng chuẩn vận hành." }
      ]
    },
    {
      slug: "gioi-thieu",
      navLabel: "Giới thiệu",
      title: "Lịch sử ra đời SmartQR",
      description: "SmartQR được xây từ nhu cầu thật: một hệ thống QR nhỏ gọn, dễ thuê, dễ bán vé và đủ rõ ràng cho đội vận hành không chuyên kỹ thuật.",
      heroImage: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
      ctaPrimary: { label: "Khám phá dịch vụ", href: "/dich-vu" },
      ctaSecondary: { label: "Về trang chủ", href: "/" },
      sortOrder: 5,
      sections: [
        { kind: "timeline", title: "Hành trình", items: [
          { title: "Ý tưởng", body: "Các sự kiện nhỏ cần soát vé nhanh nhưng không muốn đầu tư hệ thống lớn." },
          { title: "MVP", body: "Ghép thiết bị quét QR, JWT jti, API key và dashboard realtime." },
          { title: "Nền tảng", body: "Mở rộng thành ba gói: thuê thiết bị, thuê API và white-label show." }
        ] },
        { kind: "band", title: "Tầm nhìn", body: "Giúp người làm sự kiện, phòng gym, lớp học và cửa hàng nhỏ có công cụ QR đủ tốt với chi phí dễ chịu." }
      ]
    }
  ];

  for (const page of staticPages) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: page,
      create: page
    });
  }
}

main().finally(async () => prisma.$disconnect());
