"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SyncLogo from "@/components/SyncLogo";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem("sync_splashed")) {
      router.replace("/auth");
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem("sync_splashed", "1");
      router.replace("/auth");
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
        {/* グラデーションロゴ */}
        <SyncLogo width={200} />

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
