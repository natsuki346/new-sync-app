"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem("sync_splashed")) {
      router.replace("/bubble");
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem("sync_splashed", "1");
      router.replace("/bubble");
    }, 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ロゴラッパー（clip-path スライドイン） */}
      <div
        style={{
          position: "relative",
          animation: "splashSlideIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* グラデーションテキスト */}
        <span
          style={{
            fontFamily: "'Impact', 'Arial Narrow', sans-serif",
            fontWeight: 800,
            fontSize: 80,
            letterSpacing: 10,
            background: "linear-gradient(180deg, #FF1A1A 0%, #E8102A 40%, #C0000F 70%, #8B0000 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            display: "block",
            lineHeight: 1,
          }}
        >
          SYNC.
        </span>

        {/* 光沢シマー */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "40%",
              background: "linear-gradient(105deg, transparent 40%, rgba(255,200,200,0.35) 50%, transparent 60%)",
              animation: "splashShimmer 2.5s ease-in-out 0.7s infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}
