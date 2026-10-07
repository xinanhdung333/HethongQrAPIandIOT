import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartQR Platform",
  icons: {
    icon: "/brand/smartqr-icon.svg",
    shortcut: "/brand/smartqr-icon.svg",
    apple: "/brand/smartqr-icon.svg"
  },
  description: "Hệ thống QR thông minh cho thuê thiết bị, show white-label và linh kiện IoT."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={GeistSans.className}>
        {children}
      </body>
    </html>
  );
}
