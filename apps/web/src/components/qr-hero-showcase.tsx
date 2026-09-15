"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Copy, Download, Eye, QrCode, ScanLine, ShieldCheck, Ticket } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const chips = ["API Key hash", "JWT jti", "PayOS mock", "Realtime"];

export function QrHeroShowcase() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 90, damping: 22 });
  const springY = useSpring(mouseY, { stiffness: 90, damping: 22 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-7, 7]);

  return (
    <section
      className="qr-landing-hero"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        mouseX.set((event.clientX - rect.left) / rect.width - 0.5);
        mouseY.set((event.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        mouseX.set(0);
        mouseY.set(0);
      }}
    >
      <div className="hero-preview">
        <motion.div className="scan-card scan-card-left" style={{ x: useTransform(springX, [-0.5, 0.5], [-18, 18]), y: useTransform(springY, [-0.5, 0.5], [-10, 10]) }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-zinc-500">SP-01 Mini</span>
            <ScanLine size={16} />
          </div>
          <div className="mt-5 rounded-lg bg-white p-3">
            <QRCodeSVG value="smartqr:demo:gate:sp01" size={96} />
          </div>
        </motion.div>
        <motion.div className="scan-card scan-card-right" style={{ x: useTransform(springX, [-0.5, 0.5], [16, -16]), y: useTransform(springY, [-0.5, 0.5], [12, -12]) }}>
          <div className="flex items-center gap-2 text-emerald-700">
            <ShieldCheck size={18} />
            <b>Đã xác thực</b>
          </div>
          <p className="mt-2 text-sm text-zinc-600">gate-main · 182ms</p>
        </motion.div>
        <div className="device-glow" />
        <div className="device-shell">
          <div className="device-screen">
            <span className="device-line" />
            <span className="device-line short" />
            <div className="qr-grid">
              {Array.from({ length: 25 }).map((_, index) => (
                <span key={index} className={(index % 3 === 0 || index === 7 || index === 18) ? "on" : ""} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <motion.div className="hero-command-card" style={{ rotateX, rotateY, transformPerspective: 1100 }}>
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300">Nền tảng QR</span>
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5">
            <QrCode />
          </span>
        </div>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
          SmartQR cho thuê thiết bị, bán vé và quét realtime.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 md:text-lg">
          Một nền tảng QR cho phòng gym, show âm nhạc và đội IoT: tạo show white-label, PayOS demo tự paid, QR JWT chống quét lại.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-zinc-300">{chip}</span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/thue-thiet-bi" className="btn bg-white text-zinc-950">
            <Download size={16} />
            Thuê thiết bị
          </Link>
          <Link href="/tao-show" className="btn border border-white/12 bg-white/[0.06] text-white">
            <Eye size={16} />
            Tạo show
          </Link>
          <Link href="/dashboard/scan" className="btn border border-white/12 bg-white/[0.06] text-white">
            Quét thử
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.86fr]">
          <div className="rounded-xl border border-white/10 bg-[#111113] p-4">
            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span className="flex items-center gap-2"><Ticket size={16} /> Ticket JWT</span>
              <Copy size={16} />
            </div>
            <pre className="mt-4 overflow-hidden text-sm leading-7 text-zinc-300">
{`POST /api/v1/tickets/verify
X-API-KEY: sk_demo_...

{ "gate_id": "gate-main",
  "qr_jwt": "eyJhbGci..." }`}
            </pre>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm text-zinc-500">Chỉ số realtime</p>
            <div className="mt-4 grid gap-3">
              <Metric label="Vé bán" value="384 / 500" />
              <Metric label="Xác thực" value="10 req/s" />
              <Metric label="Payout" value="95%" />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">{label}</span>
        <b className="text-zinc-200">{value}</b>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-white"
          initial={{ width: "24%" }}
          whileInView={{ width: label === "Payout" ? "95%" : label === "Xác thực" ? "72%" : "76%" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
