"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState, useEffect } from "react";
import { ORGANIZERS, INFO_EVENTS } from "@/lib/mockData";

export default function OrganizerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }  = use(params);
  const org     = ORGANIZERS.find((o) => o.id === id);
  if (!org) return notFound();

  const hostedEvents = INFO_EVENTS.filter((e) => org.eventIds.includes(e.id));
  const [followed, setFollowed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("followedOrgs");
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      setFollowed(ids.includes(org.id));
    }
  }, [org.id]);

  function toggleFollow() {
    if (!org) return;
    setFollowed((prev) => {
      const stored = localStorage.getItem("followedOrgs");
      const ids: string[] = stored ? JSON.parse(stored) : [];
      const next = prev
        ? ids.filter((i) => i !== org.id)
        : [...ids, org.id];
      localStorage.setItem("followedOrgs", JSON.stringify(next));
      return !prev;
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-bg">

      {/* ── ヘッダー */}
      <header className="flex-shrink-0 z-40 bg-bg/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => history.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border active:scale-90 transition-transform"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-muted">
              <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="font-bold text-fore text-sm">Organizer Details</span>
        </div>
      </header>

      {/* ── スクロール可能なコンテンツ */}
      <div className="flex-1 overflow-y-auto">

        {/* ── ヒーローバナー */}
        <div
          className="relative w-full flex items-center justify-center overflow-hidden"
          style={{
            height: 160,
            background: "linear-gradient(155deg, #1a0a30 0%, #0a0518 60%, #050210 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at 30% 50%, rgba(230,57,70,0.12) 0%, transparent 65%)",
            }}
          />
          <div className="relative flex flex-col items-center gap-2">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl border border-white/10"
              style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}
            >
              {org.icon}
            </div>
          </div>
          <div
            className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
            style={{ background: "linear-gradient(transparent, rgb(var(--bg-rgb, 13 13 26)))" }}
          />
        </div>

        {/* ── プロフィールセクション */}
        <div className="px-5 pt-2 pb-1">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-fore leading-tight">{org.name}</h1>
              <p className="text-xs text-muted mt-0.5">{org.desc}</p>
            </div>
          </div>

          {/* 開催イベント数 */}
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-lg font-black text-fore">{org.eventsCount}</p>
              <p className="text-[10px] text-muted">Events Hosted</p>
            </div>
          </div>

          {/* フォローボタン */}
          <button
            onClick={toggleFollow}
            className="mt-4 w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
            style={
              followed
                ? {
                    background: "transparent",
                    border: "1.5px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.5)",
                  }
                : {
                    background: "linear-gradient(135deg, #E63946, #C41A27)",
                    border: "none",
                    color: "#fff",
                    boxShadow: "0 2px 16px rgba(230,57,70,0.4)",
                  }
            }
          >
            {followed ? "Following ✓" : "Follow this organizer"}
          </button>
        </div>

        <div className="mx-5 my-4 border-t border-border" />

        {/* ── 説明文 */}
        <div className="px-5 mb-5">
          <p className="text-[11px] text-muted uppercase tracking-wider mb-2">About This Community</p>
          <p className="text-sm text-fore/80 leading-relaxed">{org.bio}</p>
        </div>

        {/* ── 主催イベント一覧 */}
        <div className="px-5 pb-32">
          <p className="text-[11px] text-muted uppercase tracking-wider mb-3">Hosted Events</p>

          {hostedEvents.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <p className="text-sm text-muted">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hostedEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/search/${ev.id}`}
                  className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform block"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    {ev.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-fore truncate leading-snug">{ev.title}</p>
                    <p className="text-[11px] text-muted mt-0.5">{ev.date} · {ev.place}</p>
                    <div className="flex gap-1 mt-1">
                      {ev.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(230,57,70,0.08)", color: "#E63946" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-muted shrink-0">
                    <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
