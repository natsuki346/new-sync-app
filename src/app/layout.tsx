import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import FocusScrollHandler from "@/components/FocusScrollHandler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SYNC.",
  description: "SYNC. — Social app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SYNC.",
  },
  themeColor: "#FF1A1A",
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        {/* 375px phone frame — centered on desktop, full-screen on mobile */}
        <FocusScrollHandler />
        <div id="app-root" className="phone-frame" style={{ height: '100dvh' }}>
          {/* Content area — each page manages its own scroll */}
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
          {/* Bottom nav — pinned inside the frame */}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
