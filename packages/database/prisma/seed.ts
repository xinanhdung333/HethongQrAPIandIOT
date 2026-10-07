import { CatalogProductType, PrismaClient, ProductType, UserRole } from "@prisma/client";
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

  const categories = [
    { slug: "thiet-bi-qr", name: "Thiết bị QR", parentId: null },
    { slug: "linh-kien-iot", name: "Linh kiện IoT", parentId: null },
    { slug: "phu-kien-lap-dat", name: "Phụ kiện & lắp đặt", parentId: null },
    { slug: "bo-dieu-khien", name: "Bo mạch & điều khiển", parentId: null },
    { slug: "may-quet-qr", name: "Đầu đọc QR", parentId: null },
    { slug: "man-hinh-hien-thi", name: "Màn hình & hiển thị", parentId: null },
    { slug: "nguon-day-cap", name: "Nguồn & dây cáp", parentId: null },
    { slug: "vo-chan-de", name: "Vỏ hộp & chân đế", parentId: null }
  ];
  const savedCategories = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.productCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: { name: category.name, slug: category.slug }
    });
    savedCategories.set(category.slug, saved.id);
  }

  const products = [
    {
      slug: "sp-01-mini",
      sku: "TBT-SP-01-MINI",
      name: "SP-01 Mini",
      categoryId: savedCategories.get("thiet-bi-qr"),
      type: ProductType.IOT_MINI,
      productType: CatalogProductType.THIET_BI_THUE,
      description: "Thiết bị QR mini cho một cổng hoặc quầy check-in.",
      priceSell: 3900000,
      priceRentMonth: 690000,
      depositFee: 2000000,
      stock: 25,
      images: ["/products/sp-01.svg"],
      specs: { scanner: "GM65 UART", controller: "ESP32", display: "OLED", relay: "Servo SG90" }
    },
    {
      slug: "sp-02-pro",
      sku: "TBT-SP-02-PRO",
      name: "SP-02 Pro",
      categoryId: savedCategories.get("thiet-bi-qr"),
      type: ProductType.IOT_PRO,
      productType: CatalogProductType.THIET_BI_THUE,
      description: "Thiết bị QR công suất cao cho sự kiện lớn.",
      priceSell: 12900000,
      priceRentMonth: 1990000,
      depositFee: 5000000,
      stock: 8,
      images: ["/products/sp-02.svg"],
      specs: { scanner: "Honeywell 1470g", controller: "Raspberry Pi 4", display: "HDMI 5 inch" }
    },
    ...["gm65", "esp32", "servo-sg90", "vo-hop", "oled"].map((slug, index) => ({
      slug,
      sku: `LK-${slug.toUpperCase()}`,
      name: ["GM65 QR Scanner", "ESP32 DevKit V1", "Servo SG90", "Vỏ hộp SP-01", "OLED SSD1306"][index],
      categoryId: savedCategories.get(index === 3 ? "phu-kien-lap-dat" : "linh-kien-iot"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Linh kiện SmartQR có hỗ trợ lắp đặt theo yêu cầu.",
      priceSell: [690000, 180000, 90000, 250000, 120000][index],
      priceRentMonth: 0,
      depositFee: 0,
      stock: [80, 120, 100, 40, 100][index],
      images: ["/products/component.svg"],
      specs: { warranty: "3 tháng", service: "Lắp đặt theo yêu cầu" }
    })),
    {
      slug: "nguon-5v-3a",
      sku: "LK-NGUON-5V-3A",
      name: "Nguồn 5V 3A",
      categoryId: savedCategories.get("phu-kien-lap-dat"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Bộ nguồn ổn định cho bộ điều khiển và màn hình SmartQR.",
      priceSell: 145000,
      priceRentMonth: 0,
      depositFee: 0,
      stock: 60,
      images: ["/products/component.svg"],
      specs: { voltage: "5V", current: "3A", warranty: "3 tháng" }
    },
    {
      slug: "cap-usb-c-1m",
      sku: "LK-CAP-USB-C-1M",
      name: "Cáp USB-C 1m",
      categoryId: savedCategories.get("phu-kien-lap-dat"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Cáp kết nối và cấp nguồn cho thiết bị QR.",
      priceSell: 65000,
      priceRentMonth: 0,
      depositFee: 0,
      stock: 100,
      images: ["/products/component.svg"],
      specs: { length: "1m", connector: "USB-C" }
    },
    {
      slug: "sp-03-gate-pro",
      sku: "TBT-SP-03-GATE-PRO",
      name: "SP-03 Gate Pro",
      categoryId: savedCategories.get("thiet-bi-qr"),
      type: ProductType.IOT_PRO,
      productType: CatalogProductType.THIET_BI_THUE,
      description: "Bộ kiểm soát cổng QR có màn hình cảm ứng và relay công nghiệp.",
      priceSell: 16900000,
      priceRentMonth: 2490000,
      depositFee: 6500000,
      stock: 6,
      images: ["/products/sp-02.svg"],
      specs: { scanner: "Honeywell 1470g", controller: "Raspberry Pi 4", display: "LCD cảm ứng 5 inch", connectivity: "Wi-Fi, Ethernet" }
    },
    {
      slug: "raspberry-pi-4-2gb",
      sku: "LK-RPI4-2GB",
      name: "Raspberry Pi 4 Model B 2GB",
      categoryId: savedCategories.get("bo-dieu-khien"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Máy tính nhúng cho bộ điều khiển cổng QR cấu hình nâng cao.",
      priceSell: 1850000, priceRentMonth: 0, depositFee: 0, stock: 12,
      images: ["/products/component.svg"], specs: { ram: "2GB", connectivity: "Wi-Fi, Ethernet, Bluetooth" }
    },
    {
      slug: "esp32-s3-devkit",
      sku: "LK-ESP32-S3",
      name: "ESP32-S3 DevKitC-1",
      categoryId: savedCategories.get("bo-dieu-khien"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Bo mạch Wi-Fi/Bluetooth cho thiết bị QR IoT.",
      priceSell: 245000, priceRentMonth: 0, depositFee: 0, stock: 45,
      images: ["/products/component.svg"], specs: { cpu: "Dual-core Xtensa LX7", connectivity: "Wi-Fi, Bluetooth LE" }
    },
    {
      slug: "honeywell-1470g",
      sku: "LK-HONEYWELL-1470G",
      name: "Máy quét mã vạch Honeywell 1470g",
      categoryId: savedCategories.get("may-quet-qr"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Đầu đọc 2D có dây, đọc QR trên màn hình điện thoại nhanh.",
      priceSell: 2190000, priceRentMonth: 0, depositFee: 0, stock: 10,
      images: ["/products/component.svg"], specs: { interface: "USB", scan: "1D/2D QR", warranty: "12 tháng" }
    },
    {
      slug: "lcd-touch-5inch",
      sku: "LK-LCD-TOUCH-5",
      name: "Màn hình cảm ứng HDMI 5 inch",
      categoryId: savedCategories.get("man-hinh-hien-thi"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Màn hình trạng thái và hướng dẫn check-in tại cổng.",
      priceSell: 1250000, priceRentMonth: 0, depositFee: 0, stock: 14,
      images: ["/products/component.svg"], specs: { size: "5 inch", interface: "HDMI, USB touch", resolution: "800x480" }
    },
    {
      slug: "relay-1ch-5v",
      sku: "LK-RELAY-1CH-5V",
      name: "Module relay 1 kênh 5V",
      categoryId: savedCategories.get("linh-kien-iot"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Điều khiển khóa điện hoặc servo tại một cổng.",
      priceSell: 45000, priceRentMonth: 0, depositFee: 0, stock: 80,
      images: ["/products/component.svg"], specs: { channels: "1", voltage: "5V" }
    },
    {
      slug: "relay-4ch-5v",
      sku: "LK-RELAY-4CH-5V",
      name: "Module relay 4 kênh 5V",
      categoryId: savedCategories.get("linh-kien-iot"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Điều khiển nhiều làn hoặc nhiều thiết bị ngoại vi.",
      priceSell: 115000, priceRentMonth: 0, depositFee: 0, stock: 35,
      images: ["/products/component.svg"], specs: { channels: "4", voltage: "5V" }
    },
    {
      slug: "buzzer-active-5v",
      sku: "LK-BUZZER-5V",
      name: "Còi báo trạng thái 5V",
      categoryId: savedCategories.get("linh-kien-iot"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Báo hiệu âm thanh khi QR hợp lệ hoặc bị từ chối.",
      priceSell: 18000, priceRentMonth: 0, depositFee: 0, stock: 100,
      images: ["/products/component.svg"], specs: { voltage: "5V", type: "Active buzzer" }
    },
    {
      slug: "wifi-antenna-2dbi",
      sku: "LK-WIFI-ANT-2DBI",
      name: "Ăng-ten Wi-Fi 2dBi",
      categoryId: savedCategories.get("bo-dieu-khien"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Ăng-ten thay thế cho bộ điều khiển đặt trong tủ kim loại.",
      priceSell: 55000, priceRentMonth: 0, depositFee: 0, stock: 40,
      images: ["/products/component.svg"], specs: { gain: "2dBi", connector: "IPEX/SMA" }
    },
    {
      slug: "power-12v-5a",
      sku: "LK-POWER-12V-5A",
      name: "Nguồn tổ ong 12V 5A",
      categoryId: savedCategories.get("nguon-day-cap"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Nguồn cấp cho khóa điện, màn hình và phụ kiện cổng.",
      priceSell: 185000, priceRentMonth: 0, depositFee: 0, stock: 30,
      images: ["/products/component.svg"], specs: { output: "12V 5A", protection: "Quá tải, ngắn mạch" }
    },
    {
      slug: "buck-12v-5v-3a",
      sku: "LK-BUCK-12V-5V",
      name: "Module hạ áp 12V xuống 5V 3A",
      categoryId: savedCategories.get("nguon-day-cap"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Cấp nguồn 5V ổn định từ nguồn 12V cho bộ điều khiển.",
      priceSell: 39000, priceRentMonth: 0, depositFee: 0, stock: 55,
      images: ["/products/component.svg"], specs: { input: "12V", output: "5V 3A" }
    },
    {
      slug: "vo-abs-ip54",
      sku: "LK-CASE-ABS-IP54",
      name: "Vỏ hộp ABS chống bụi IP54",
      categoryId: savedCategories.get("vo-chan-de"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Vỏ bảo vệ bo mạch lắp tại quầy hoặc khu vực có mái che.",
      priceSell: 320000, priceRentMonth: 0, depositFee: 0, stock: 22,
      images: ["/products/component.svg"], specs: { material: "ABS", protection: "IP54" }
    },
    {
      slug: "chan-de-may-quet",
      sku: "LK-STAND-SCANNER",
      name: "Chân đế máy quét QR để bàn",
      categoryId: savedCategories.get("vo-chan-de"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Giữ cố định đầu đọc QR tại quầy check-in.",
      priceSell: 185000, priceRentMonth: 0, depositFee: 0, stock: 18,
      images: ["/products/component.svg"], specs: { material: "Thép sơn tĩnh điện", mount: "Để bàn" }
    },
    {
      slug: "kinh-bao-ve-lcd-5",
      sku: "LK-GLASS-LCD-5",
      name: "Kính bảo vệ màn hình 5 inch",
      categoryId: savedCategories.get("man-hinh-hien-thi"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Tấm kính bảo vệ màn hình quầy khỏi trầy xước.",
      priceSell: 95000, priceRentMonth: 0, depositFee: 0, stock: 25,
      images: ["/products/component.svg"], specs: { size: "5 inch", material: "Kính cường lực" }
    },
    {
      slug: "cap-mang-cat6-2m",
      sku: "LK-LAN-CAT6-2M",
      name: "Cáp mạng Cat6 2m",
      categoryId: savedCategories.get("nguon-day-cap"),
      type: ProductType.COMPONENT,
      productType: CatalogProductType.LINH_KIEN,
      description: "Kết nối Ethernet ổn định cho cổng soát vé.",
      priceSell: 45000, priceRentMonth: 0, depositFee: 0, stock: 50,
      images: ["/products/component.svg"], specs: { category: "Cat6", length: "2m" }
    }
  ];

  const savedProducts = new Map<string, string>();
  for (const product of products) {
    let saved = await prisma.product.upsert({ where: { slug: product.slug }, update: {}, create: product });
    if (!saved.categoryId && product.categoryId) {
      saved = await prisma.product.update({ where: { id: saved.id }, data: { categoryId: product.categoryId } });
    }
    savedProducts.set(product.slug, saved.id);
    if (product.productType === CatalogProductType.LINH_KIEN) {
      await prisma.productSaleDetails.upsert({
        where: { productId: saved.id },
        update: {},
        create: { productId: saved.id, giaNhap: Math.round(product.priceSell * 0.7), giaBan: product.priceSell, soLuongTon: product.stock, baoHanhThang: 3 }
      });
    } else {
      await prisma.productRentalDetails.upsert({
        where: { productId: saved.id },
        update: {},
        create: { productId: saved.id, giaThueThang: product.priceRentMonth, tienCoc: product.depositFee, tongSoLuong: product.stock, soLuongKhaDung: product.stock }
      });
    }
  }

  const sp01Id = savedProducts.get("sp-01-mini");
  const sp02Id = savedProducts.get("sp-02-pro");
  const sp03Id = savedProducts.get("sp-03-gate-pro");
  if (sp01Id && sp02Id) {
    const compatibleDevices: Record<string, string[]> = {
      gm65: [sp01Id, sp02Id],
      esp32: [sp01Id, sp02Id],
      "servo-sg90": [sp01Id],
      "vo-hop": [sp01Id],
      oled: [sp01Id, sp02Id],
      "nguon-5v-3a": [sp01Id, sp02Id],
      "raspberry-pi-4-2gb": [sp02Id],
      "esp32-s3-devkit": [sp01Id, sp02Id],
      "honeywell-1470g": [sp02Id],
      "lcd-touch-5inch": [sp02Id],
      "relay-1ch-5v": [sp01Id, sp02Id],
      "relay-4ch-5v": [sp02Id],
      "buzzer-active-5v": [sp01Id, sp02Id],
      "wifi-antenna-2dbi": [sp01Id, sp02Id],
      "power-12v-5a": [sp01Id, sp02Id],
      "buck-12v-5v-3a": [sp01Id, sp02Id],
      "vo-abs-ip54": [sp01Id, sp02Id],
      "chan-de-may-quet": [sp01Id, sp02Id],
      "kinh-bao-ve-lcd-5": [sp02Id],
      "cap-mang-cat6-2m": [sp02Id]
    };
    for (const [componentSlug, deviceIds] of Object.entries(compatibleDevices)) {
      const componentId = savedProducts.get(componentSlug);
      if (!componentId) continue;
      for (const deviceId of deviceIds) {
        await prisma.productCompatibility.upsert({
          where: { componentId_deviceId: { componentId, deviceId } },
          update: {},
          create: { componentId, deviceId }
        });
      }
    }
  }

  const rentalUnits = [
    ...Array.from({ length: 5 }, (_, index) => ({ serial: `SP01-DEMO-${String(index + 1).padStart(3, "0")}`, productId: sp01Id, location: "Kho TP.HCM" })),
    ...Array.from({ length: 2 }, (_, index) => ({ serial: `SP02-DEMO-${String(index + 1).padStart(3, "0")}`, productId: sp02Id, location: "Kho TP.HCM" })),
    ...Array.from({ length: 3 }, (_, index) => ({ serial: `SP03-DEMO-${String(index + 1).padStart(3, "0")}`, productId: sp03Id, location: "Kho TP.HCM" }))
  ];
  for (const unit of rentalUnits) {
    if (!unit.productId) continue;
    await prisma.rentalUnit.upsert({
      where: { serial: unit.serial },
      update: {},
      create: { ...unit, productId: unit.productId }
    });
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
      update: {},
      create: page
    });
  }
}

main().finally(async () => prisma.$disconnect());
