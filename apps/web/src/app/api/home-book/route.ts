import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { API_URL, type StaticPage } from "@/lib/api";

export const dynamic = "force-dynamic";

const DEFAULT_SLUG = "home";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80";

type Stage = {
  label: string;
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  image: string;
  stats: Array<{ value: string; label: string }>;
  features: Array<{ title: string; body: string }>;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(value = "") {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function shortText(value = "", max = 120) {
  const clean = stripTags(value);
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}...` : clean;
}

function replaceText(html: string, selectorRegex: RegExp, value: string) {
  return html.replace(selectorRegex, (match) => {
    const openEnd = match.indexOf(">") + 1;
    const closeStart = match.lastIndexOf("<");
    return `${match.slice(0, openEnd)}${escapeHtml(value)}${match.slice(closeStart)}`;
  });
}

async function getStaticPage(slug: string) {
  const response = await fetch(`${API_URL}/cms/pages/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  return response.json() as Promise<StaticPage>;
}

function buildStages(page: StaticPage | null): Stage[] {
  const heroImage = page?.heroImage || FALLBACK_IMAGE;
  const sections = page?.sections ?? [];
  const defaults: Stage[] = [
    {
      label: "Dịch vụ",
      eyebrow: "Gói triển khai SmartQR",
      title: "Thuê thiết bị, bán vé show và kiểm soát QR trong một nền tảng",
      accent: "Quy trình QR thống nhất",
      body: "SmartQR giúp đội vận hành bắt đầu nhanh với thiết bị quét, vé điện tử, API verify và dashboard realtime.",
      image: heroImage,
      stats: [
        { value: "690k", label: "từ mỗi tháng" },
        { value: "5%", label: "phí nền tảng show" },
        { value: "Realtime", label: "theo dõi lượt quét" },
        { value: "API", label: "verify QR" }
      ],
      features: []
    },
    {
      label: "Cổng soát vé",
      eyebrow: "Thiết bị và vận hành",
      title: "Quét QR nhanh, chống quét lại và hỗ trợ nhiều điểm vào",
      accent: "Kiểm soát ra vào rõ ràng",
      body: "Mỗi QR có trạng thái riêng, hỗ trợ kiểm tra tại cổng và lưu lịch sử quét để đội vận hành đối soát dễ hơn.",
      image: heroImage,
      stats: [],
      features: [
        { title: "Xác thực một lần", body: "Chống vé giả, vé quay vòng và ghi nhận lượt vào." },
        { title: "Thiết bị sẵn sàng", body: "Cho thuê hộp quét, scanner và gói triển khai theo nhu cầu." },
        { title: "Dashboard realtime", body: "Theo dõi vé bán, vé đã dùng và tình trạng cổng." }
      ]
    },
    {
      label: "API",
      eyebrow: "Tích hợp cho hệ thống có sẵn",
      title: "API verify QR cho website, app và cổng quét riêng",
      accent: "Tích hợp gọn, có kiểm soát",
      body: "Dùng API key, rate limit và webhook để kết nối SmartQR vào hệ thống bán vé, thành viên hoặc check-in hiện có.",
      image: heroImage,
      stats: [],
      features: [
        { title: "REST API", body: "Endpoint verify đơn giản, phản hồi rõ trạng thái." },
        { title: "Webhook", body: "Đẩy sự kiện thanh toán, bán vé và quét QR." },
        { title: "Bảo mật", body: "API key hash, scope và rate limit theo gói." }
      ]
    },
    {
      label: "Triển khai",
      eyebrow: "Từ demo đến vận hành",
      title: "Một luồng triển khai dễ hiểu cho đội nhỏ",
      accent: "Bắt đầu nhanh, mở rộng sau",
      body: "Admin có thể sửa ảnh, menu, CTA và nội dung trang tĩnh ngay trong PostgreSQL CMS mà không cần sửa code.",
      image: heroImage,
      stats: [],
      features: [
        { title: "Quản lý trang tĩnh", body: "Sửa hero, mô tả, CTA và section từ admin." },
        { title: "Quản lý sản phẩm", body: "Giá thuê, cọc, tồn kho và ảnh sản phẩm." },
        { title: "Quản lý show", body: "Tạo trang bán vé và theo dõi doanh thu." }
      ]
    }
  ];

  return defaults.map((fallback, index) => {
    const section = sections[index];
    if (!section) return fallback;
    const items = section.items ?? [];
    const stats = items
      .filter((item) => item.value || item.price)
      .slice(0, 4)
      .map((item) => ({ value: item.value || item.price || "", label: item.label || item.title || "" }));
    const features = items
      .filter((item) => item.title || item.body)
      .slice(0, 4)
      .map((item) => ({ title: item.title || item.value || fallback.label, body: item.body || item.label || "" }));
    return {
      ...fallback,
      eyebrow: section.subtitle || fallback.eyebrow,
      title: section.title || fallback.title,
      body: section.body || section.subtitle || fallback.body,
      stats: stats.length ? stats : fallback.stats,
      features: features.length ? features : fallback.features
    };
  });
}

function featureHtml(features: Stage["features"], color: string) {
  return features
    .map(
      (feature) => `<div class="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
            <i data-lucide="check-circle2" class="w-5 h-5 text-${color}-400"></i>
            <h4 class="font-bold text-white text-sm">${escapeHtml(feature.title)}</h4>
            <p class="text-xs text-slate-400">${escapeHtml(feature.body)}</p>
          </div>`
    )
    .join("");
}

function statHtml(stats: Stage["stats"], color: string) {
  return stats
    .slice(0, 4)
    .map(
      (stat) => `<div class="p-4 rounded-xl bg-white/5 border border-white/5">
            <div class="text-2xl font-bold text-${color}-400 font-display">${escapeHtml(stat.value)}</div>
            <div class="text-xs text-slate-400 mt-1">${escapeHtml(stat.label)}</div>
          </div>`
    )
    .join("");
}

function brandHtml() {
  return `<a href="/" class="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-zinc-950 shadow-sm">
      <span class="grid size-9 place-items-center rounded-lg bg-zinc-950 text-white">
        <i data-lucide="scan-line" class="h-5 w-5"></i>
      </span>
      <span class="font-display text-lg font-bold tracking-tight">SmartQR</span>
    </a>`;
}

function loginHtml() {
  return `<a href="/dang-nhap" target="_parent" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white px-4 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-100">
      <i data-lucide="log-in" class="h-4 w-4"></i>
      <span>Đăng nhập</span>
    </a>`;
}

function applyCms(html: string, page: StaticPage | null, stages: Stage[]) {
  const title = page?.title || "SmartQR Platform";
  const description = page?.description || "Hệ thống QR thông minh cho thiết bị, vé điện tử, API verify và quản lý lượt quét realtime.";
  const primary = page?.ctaPrimary ?? { label: "Khám phá dịch vụ", href: "#stage-1" };

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<div class="flex items-center space-x-3">[\s\S]*?<\/div>\s*<!-- Stage Quick Jump Bar -->/,
    `<div class="flex items-center space-x-3">${brandHtml()}</div>\n\n  <!-- Stage Quick Jump Bar -->`
  );
  html = html.replace(
    /<!-- Actions -->[\s\S]*?<\/div>\s*<\/nav>/,
    `<!-- Actions -->\n  <div class="flex items-center space-x-3">${loginHtml()}</div>\n</nav>`
  );
  html = html.replace(/<span>Smooth Scroll Image Zoom & Parallax Journey<\/span>/, `<span>SmartQR CMS Landing</span>`);
  html = html.replace(/HÃ nh TrÃ¬nh <br><span class="text-gradient-blue">[\s\S]*?<\/span>/, `${escapeHtml(title)} <br><span class="text-gradient-blue">SmartQR</span>`);
  html = replaceText(html, /<p class="text-base text-slate-300 leading-relaxed font-light">[\s\S]*?<\/p>/, description);
  html = html.replace(/<span>KhÃ¡m PhÃ¡ Chi Tiáº¿t<\/span>/, `<span>${escapeHtml(primary.label)}</span>`);
  html = html.replace(/onclick="scrollToStage\(1\)"/, `onclick="location.href='${escapeHtml(primary.href || "#stage-1")}'"`);

  const colors = ["pink", "emerald", "cyan", "amber"];
  const icons = ["ticket-check", "qr-code", "cloud-cog", "settings-2"];
  stages.forEach((stage, index) => {
    const n = index + 1;
    html = html.replace(new RegExp(`<img id="bg-stage-${n}" src="[^"]+" alt="[^"]*"`, "g"), `<img id="bg-stage-${n}" src="${escapeHtml(stage.image)}" alt="${escapeHtml(stage.title)}"`);
    html = html.replace(new RegExp(`>\\s*${n}\\. [^<]+</button>`), `> <span class="w-2 h-2 rounded-full bg-${colors[index]}-400"></span> ${n}. ${escapeHtml(stage.label)}</button>`);
    html = html.replace(new RegExp(`<span class="px-3 py-1 rounded-md text-xs font-bold bg-${colors[index]}-500/20 text-${colors[index]}-300 border border-${colors[index]}-500/30">STAGE 0${n}</span>[\\s\\S]*?<i data-lucide="[^"]+" class="w-6 h-6 text-${colors[index]}-400"></i>`), `<span class="px-3 py-1 rounded-md text-xs font-bold bg-${colors[index]}-500/20 text-${colors[index]}-300 border border-${colors[index]}-500/30">0${n}</span>
            <span class="text-xs uppercase tracking-widest text-slate-400">${escapeHtml(stage.eyebrow)}</span>
          </div>
          <i data-lucide="${icons[index]}" class="w-6 h-6 text-${colors[index]}-400"></i>`);
  });

  const h2Matches = [...html.matchAll(/<h2 class="font-display text-3xl sm:text-5xl font-bold text-white">[\s\S]*?<\/h2>/g)];
  h2Matches.slice(0, 4).forEach((match, index) => {
    html = html.replace(match[0], `<h2 class="font-display text-3xl sm:text-5xl font-bold text-white">
          ${escapeHtml(stages[index].title)}<br><span class="text-gradient-${index === 1 || index === 3 ? "gold" : index === 2 ? "cyan" : "pink"}">${escapeHtml(stages[index].accent)}</span>
        </h2>`);
  });

  const paragraphMatches = [...html.matchAll(/<p class="text-slate-300 leading-relaxed text-sm sm:text-base">[\s\S]*?<\/p>/g)];
  paragraphMatches.slice(0, 4).forEach((match, index) => {
    html = html.replace(match[0], `<p class="text-slate-300 leading-relaxed text-sm sm:text-base">${escapeHtml(stages[index].body)}</p>`);
  });

  html = html.replace(/<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">[\s\S]*?<\/div>\s*<!-- Content Input \/ Note Box -->/, `<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">${statHtml(stages[0].stats, "pink")}</div>`);
  html = html.replace(/<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">[\s\S]*?<\/div>\s*<!-- Content Input \/ Note Box -->/, `<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">${featureHtml(stages[1].features, "emerald")}</div>`);
  html = html.replace(/<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">[\s\S]*?<\/div>\s*<!-- Content Input \/ Note Box -->/, `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">${featureHtml(stages[2].features, "cyan")}</div>`);
  html = html.replace(/<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">[\s\S]*?<\/div>\s*<!-- Content Input \/ Note Box -->/, `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">${featureHtml(stages[3].features, "amber")}</div>`);

  return html;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || DEFAULT_SLUG;
  const sourcePath = path.resolve(process.cwd(), "index.html");
  const page = await getStaticPage(slug).catch(() => null);
  const stages = buildStages(page);
  let html = await readFile(sourcePath, "utf8");

  html = applyCms(html, page, stages);
  html = html.replace(
    "</style>",
    `.admin-only-control,#audio-toggle,#panel-toggle,#settings-panel,.fixed.left-6.bottom-6,textarea,label:has(+ textarea),.pt-2:has(textarea){display:none!important}
      .glass-card{border-radius:12px!important}
      nav .lg\\:flex{display:flex}
      @media(max-width:1024px){nav .lg\\:flex{display:none}}
    </style>`
  );

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
