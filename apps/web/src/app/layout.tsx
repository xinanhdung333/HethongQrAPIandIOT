import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { NavProgress } from "@/components/nav-progress";
import { SiteChrome } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "SmartQR Platform",
  description: "Hệ thống QR thông minh cho thuê thiết bị, show white-label và linh kiện IoT."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={GeistSans.className}>
        <NavProgress />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
