import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import FocusScrollHandler from "@/components/FocusScrollHandler";
import { AuthProvider } from "@/contexts/AuthContext";
import { IntlProvider } from "@/components/IntlProvider";
import { CallProvider } from "@/contexts/CallContext";
import IncomingCallOverlay from "@/components/call/IncomingCallOverlay";
import OutgoingCallOverlay from "@/components/call/OutgoingCallOverlay";
import ActiveCallOverlay from "@/components/call/ActiveCallOverlay";

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
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF1A1A",
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
        <AuthProvider>
  <IntlProvider>
    <CallProvider>
      <div id="app-root" className="phone-frame" style={{ height: '100dvh' }}>
        {/* Content area ... */}
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
        {/* Bottom nav ... */}
        <BottomNav />
      </div>
      <IncomingCallOverlay />
      <OutgoingCallOverlay />
      <ActiveCallOverlay />
    </CallProvider>
  </IntlProvider>
</AuthProvider>
      </body>
    </html>
  );
}
