"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { INFO_EVENTS } from "@/lib/mockData";
import ReactionPicker from "@/components/ReactionPicker";

// ── 友達の参加モックデータ ────────────────────────────────────────

type FriendEntry = { name: string; avatar: string };

const FRIEND_ACTIVITY: Record<string, {
  joining: FriendEntry[];
  saved:   FriendEntry[];
  liked:   FriendEntry[];
}> = {
  e1: {
    joining: [{ name: "yuki", avatar: "🌸" }, { name: "kai", avatar: "🎨" }, { name: "ren", avatar: "📸" }],
    saved:   [{ name: "ao",   avatar: "🖊️" }],
    liked:   [{ name: "nagi", avatar: "☕" }, { name: "tomo", avatar: "🎸" }],
  },
  e2: {
    joining: [{ name: "ren",  avatar: "📸" }, { name: "kai", avatar: "🎨" }],
    saved:   [{ name: "yuki", avatar: "🌸" }, { name: "ao",  avatar: "🖊️" }],
    liked:   [],
  },
  e3: {
    joining: [{ name: "mai",  avatar: "💻" }],
    saved:   [{ name: "kai",  avatar: "🎨" }],
    liked:   [{ name: "ren",  avatar: "📸" }],
  },
  e4: {
    joining: [{ name: "nagi", avatar: "☕" }, { name: "ao", avatar: "🖊️" }],
    saved:   [],
    liked:   [{ name: "yuki", avatar: "🌸" }],
  },
  e5: {
    joining: [{ name: "kai",  avatar: "🎨" }],
    saved:   [{ name: "ren",  avatar: "📸" }, { name: "yuki", avatar: "🌸" }],
    liked:   [{ name: "nagi", avatar: "☕" }],
  },
};

function buildJoiningText(list: FriendEntry[]): string {
  if (list.length === 0) return "";
  if (list.length === 1) return `${list[0].name} is planning to attend`;
  if (list.length === 2) return `${list[0].name} & ${list[1].name} are planning to attend`;
  return `${list[0].name} & ${list[1].name} are also planning to attend`;
}

// ── イベントごとの追加情報 ────────────────────────────────────────

const EVENT_EXTRA: Record<string, {
  colors:      [string, string, string];
  access:      string;
  fullDesc:    string;
  organizer:   { name: string; icon: string; desc: string };
  organizerId: string;
  capacity:    string;
  fee:         string;
  feeAmount:   number;
}> = {
  e1: {
    colors:      ["#3D1A7A", "#1A0B40", "#0A0520"],
    access:      "3 min walk from Shinjuku Station (JR / Marunouchi Line)",
    fullDesc:    "A night of music and connection for people with the same passion. Your ticket is just that passion. The world of jprock beyond genre borders, and chance encounters await. Feel the venue energy on SYNC Bubble while resonating with a stranger.",
    organizer:   { name: "SYNC LIVE collective", icon: "🎸", desc: "A community creating music × chance encounters" },
    organizerId: "org-e1",
    capacity:    "Up to 200",
    fee:         "¥3,000",
    feeAmount:   3000,
  },
  e2: {
    colors:      ["#0D3A6B", "#061A35", "#020A15"],
    access:      "1 min walk from Shibuya Station Hachiko Exit",
    fullDesc:    "Walk around Shibuya with just your phone. A night snap meetup. Share the photos you take on the spot and naturally connect with people who share your sensibility. Camera skills don't matter. Just shoot what you feel.",
    organizer:   { name: "Photo Club SNAP", icon: "📷", desc: "A group sharing everyday photo opportunities" },
    organizerId: "org-e2",
    capacity:    "Up to 30",
    fee:         "Free",
    feeAmount:   0,
  },
  e3: {
    colors:      ["#0A3040", "#041520", "#020810"],
    access:      "Shibuya Hikarie 8F, direct access from Shibuya Station (Tokyu Toyoko Line)",
    fullDesc:    "Share focused work time together. A casual atmosphere where you can chat too. Write code, plan designs, build something — come here if you're making anything. Somehow solo late-night work flows when done together.",
    organizer:   { name: "Focus Session Tokyo", icon: "💻", desc: "Focused work community for engineers and designers" },
    organizerId: "org-e3",
    capacity:    "Up to 50",
    fee:         "¥1,000 (incl. drinks)",
    feeAmount:   1000,
  },
  e4: {
    colors:      ["#5C2A00", "#2A1000", "#0F0500"],
    access:      "5 min walk from Daikanyama Station (Tokyu Toyoko Line)",
    fullDesc:    "A slow evening with coffee and carefully chosen words. Late-night only. Whether you care about the beans or just want to drink. We want to meet people who love that kind of night.",
    organizer:   { name: "Late Night Coffee Club", icon: "☕", desc: "A minimal community that loves coffee and conversation" },
    organizerId: "org-e4",
    capacity:    "Up to 15",
    fee:         "Free",
    feeAmount:   0,
  },
  e5: {
    colors:      ["#4A0D7A", "#200540", "#0A0220"],
    access:      "4 min walk from Roppongi Station (Toei Oedo Line)",
    fullDesc:    "Just talk about design. A session on the aesthetics of subtraction. UI, graphic, product — no genre limits. \"What to remove\" over \"what to add\". Anyone who values those aesthetics is welcome, at any level.",
    organizer:   { name: "Design Philosophy Club", icon: "🎨", desc: "A community exploring the aesthetics of subtraction" },
    organizerId: "org-e5",
    capacity:    "Up to 40",
    fee:         "¥2,000",
    feeAmount:   2000,
  },
};

// ── 決済モーダル ────────────────────────────────────────────────

type PaymentMethod = "paypay" | "card" | "convenience";

function PaymentModal({
  eventTitle,
  feeAmount,
  onConfirm,
  onClose,
}: {
  eventTitle: string;
  feeAmount: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("paypay");

  const methods: { id: PaymentMethod; label: string; desc: string }[] = [
    { id: "paypay",      label: "PayPay",            desc: "Pay with PayPay app" },
    { id: "card",        label: "Credit Card",        desc: "VISA / Mastercard / JCB" },
    { id: "convenience", label: "Convenience Store",  desc: "Lawson · FamilyMart · 7-Eleven" },
  ];

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* モーダル本体 */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 390,
          maxHeight: "calc(100vh - 80px)",
          overflowY: "auto",
          zIndex: 50,
          background: "#181818",
          borderRadius: "16px 16px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ハンドルバー */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
        </div>

        {/* 注文サマリー */}
        <div style={{ padding: "12px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Payment Details
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {eventTitle}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Entry Fee</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#E63946" }}>¥{feeAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* 支払い方法リスト */}
        <div style={{ padding: "12px 16px 0" }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Select Payment Method
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${method === m.id ? "rgba(230,57,70,0.55)" : "rgba(255,255,255,0.08)"}`,
                  background: method === m.id ? "rgba(230,57,70,0.09)" : "rgba(255,255,255,0.03)",
                  width: "100%",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {/* ラジオボタン */}
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  border: `2px solid ${method === m.id ? "#E63946" : "rgba(255,255,255,0.22)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {method === m.id && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E63946" }} />
                  )}
                </div>
                {/* アイコン */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>
                  {m.id === "paypay" ? "🟡" : m.id === "card" ? "💳" : "🏪"}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{m.label}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", margin: 0 }}>{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 確定ボタン */}
        <div style={{
          position: "sticky",
          bottom: 0,
          padding: "12px 16px 80px",
          background: "#181818",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          marginTop: 12,
        }}>
          <button
            onClick={onConfirm}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 16,
              fontWeight: 700,
              fontSize: 15,
              color: "#fff",
              background: "linear-gradient(135deg, #E63946, #C41A27)",
              boxShadow: "0 4px 16px rgba(230,57,70,0.38)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Apply with this payment method
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100%); }
          to   { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}

// ── ページコンポーネント ──────────────────────────────────────────

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const ev     = INFO_EVENTS.find((e) => e.id === id);
  if (!ev) notFound();

  const extra = EVENT_EXTRA[ev.id] ?? {
    colors:      ["#3D1A7A", "#1A0B40", "#0A0520"] as [string, string, string],
    access:      "Please contact the organizer for details",
    fullDesc:    ev.desc,
    organizer:   { name: "SYNC", icon: "✨", desc: "SYNC Community" },
    organizerId: "",
    capacity:    "TBD",
    fee:         "TBD",
    feeAmount:   0,
  };

  const [c1, c2, c3] = extra.colors;

  const [joined,         setJoined]         = useState(false);
  const [showPayment,    setShowPayment]    = useState(false);
  const [eventReaction,  setEventReaction]  = useState<string | null>(null);
  const [reactionCount,  setReactionCount]  = useState(0);

  function handleJoin() {
    if (joined) return;
    if (extra.feeAmount > 0) {
      setShowPayment(true);
    } else {
      setJoined(true);
    }
  }

  function handlePaymentConfirm() {
    setShowPayment(false);
    setJoined(true);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-bg">

      {/* ── ヘッダー ──────────────────────────────────────────── */}
      <header className="flex-shrink-0 z-40 bg-bg/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border active:scale-90 transition-transform"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-muted">
              <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="font-bold text-fore text-sm">Event Details</span>
        </div>
      </header>

      {/* ── スクロール可能なコンテンツ ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── ビジュアルバナー ──────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 220,
            background: `linear-gradient(155deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`,
          }}
        >
          <div
            className="absolute top-[-40px] left-[-30px] w-64 h-64 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${c1}BB 0%, transparent 70%)`, filter: "blur(40px)" }}
          />
          <div
            className="absolute bottom-[-20px] right-[-20px] w-48 h-48 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${c1}77 0%, transparent 70%)`, filter: "blur(30px)" }}
          />
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white pointer-events-none"
              style={{
                width:   [3,2,4,2,3,2][i],
                height:  [3,2,4,2,3,2][i],
                top:     `${[15,55,25,70,40,80][i]}%`,
                left:    `${[12,80,55,20,88,45][i]}%`,
                opacity: [0.15,0.1,0.12,0.1,0.08,0.1][i],
              }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="select-none" style={{ fontSize: 110, opacity: 0.18, filter: "blur(1px)" }}>
              {ev.emoji}
            </span>
          </div>
          <div
            className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
            style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.5))" }}
          />
          <div className="absolute bottom-4 left-5 flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl border border-white/20"
              style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
            >
              {ev.emoji}
            </div>
            <div>
              {ev.tags.map((tag) => (
                <span key={tag} className="text-white/70 text-[10px] mr-1.5">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── コンテンツ ─────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-10 space-y-5">

          {/* イベント名 */}
          <div>
            <h1 className="text-2xl font-black text-fore leading-tight mb-2">
              {ev.title}
            </h1>
            <p className="text-sm text-fore/75 leading-relaxed">
              {extra.fullDesc}
            </p>
          </div>

          {/* ── 日時・場所・アクセス カード ─────────────────────── */}
          <div className="bg-surface border border-border rounded-2xl divide-y divide-border overflow-hidden">
            <InfoRow icon="📅" label="Date"     value={ev.date} />
            <InfoRow icon="📍" label="Venue"    value={ev.place} />
            <InfoRow icon="🚉" label="Access"   value={extra.access} />
            <InfoRow icon="👥" label="Capacity" value={extra.capacity} />
            {/* 参加費行 */}
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="text-base shrink-0 mt-0.5">💰</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted mb-0.5">Entry Fee</p>
                <p
                  className="text-sm font-semibold leading-snug"
                  style={{ color: extra.feeAmount > 0 ? "#E63946" : "rgb(var(--fore-rgb))" }}
                >
                  {extra.feeAmount > 0 ? `Entry Fee: ${extra.fee}` : "Free"}
                </p>
              </div>
            </div>
          </div>

          {/* ── ハッシュタグ ─────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {ev.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: "rgba(230,57,70,0.06)", color: "#E63946", border: "1px solid rgba(230,57,70,0.2)" }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* ── 主催者情報 ───────────────────────────────── */}
          <Link
            href={extra.organizerId ? `/organizer/${extra.organizerId}` : "#"}
            className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform block"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border border-border"
              style={{ background: "rgb(var(--surface-rgb))" }}
            >
              {extra.organizer.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted mb-0.5">Organizer</p>
              <p className="text-sm font-bold text-fore truncate">{extra.organizer.name}</p>
              <p className="text-[11px] text-muted truncate">{extra.organizer.desc}</p>
            </div>
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(230,57,70,0.1)", border: "1px solid rgba(230,57,70,0.2)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>

          {/* ── 友達の参加状況 ──────────────────────────────────── */}
          <FriendActivity eventId={ev.id} />

          {/* ── リアクション ────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-border px-5 py-4 flex items-center gap-4"
            style={{ background: "rgb(var(--surface-rgb))" }}
          >
            <span className="text-xs text-muted font-medium flex-1">このイベントへのリアクション</span>
            <ReactionPicker
              hashtagId={ev.tags[0] ?? ev.id}
              postId={ev.id}
              onReact={(emoji) => {
                if (eventReaction !== emoji) {
                  setEventReaction(emoji);
                  setReactionCount((c) => c + 1);
                }
              }}
              initialEmoji={eventReaction}
              reactionCount={reactionCount}
            />
          </div>

          {/* ── アクションボタン ─────────────────────────────────── */}
          <div className="space-y-3 pt-1">

            {/* 参加するボタン */}
            <button
              onClick={handleJoin}
              className="w-full py-4 rounded-2xl font-bold text-base text-white active:scale-[0.98] transition-transform"
              style={{
                background: joined
                  ? "linear-gradient(135deg, #888, #666)"
                  : "linear-gradient(135deg, #E63946, #C41A27)",
                boxShadow: joined
                  ? "none"
                  : "0 4px 20px rgba(230,57,70,0.4)",
              }}
            >
              {joined
                ? "Applied ✓"
                : extra.feeAmount > 0
                  ? `Join (¥${extra.feeAmount.toLocaleString()})`
                  : "Join This Event"}
            </button>

            {/* Bubbleで声を聞くボタン */}
            <Link
              href={`/search/${id}/bubble`}
              className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border active:scale-[0.98] transition-transform"
              style={{
                background: "linear-gradient(135deg, rgba(255,107,157,0.08), rgba(0,180,216,0.06))",
                borderColor: "#FF6B9D",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <circle cx="8.5"  cy="9"    r="4.5" stroke="#00B4D8" strokeWidth={1.8} />
                <circle cx="17"   cy="13.5" r="3.5" stroke="#FF6B9D" strokeWidth={1.5} />
                <circle cx="7"    cy="18"   r="2.5" stroke="#FFD166" strokeWidth={1.4} />
              </svg>
              <span style={{ background: "linear-gradient(90deg, #FF6B9D, #00B4D8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Hear the Vibe on Bubble
              </span>
            </Link>

          </div>

          <p className="text-muted/50 text-[11px] leading-relaxed text-center pb-2">
            See what people at this venue are saying right now, in real time on SYNC Bubble.
          </p>

        </div>
      </div>

      {/* ── 決済モーダル ─────────────────────────────────────── */}
      {showPayment && (
        <PaymentModal
          eventTitle={ev.title}
          feeAmount={extra.feeAmount}
          onConfirm={handlePaymentConfirm}
          onClose={() => setShowPayment(false)}
        />
      )}

    </div>
  );
}

// ── FriendActivity セクション ─────────────────────────────────────

function FriendActivity({ eventId }: { eventId: string }) {
  const act = FRIEND_ACTIVITY[eventId];
  if (!act) return null;
  const { joining, saved, liked } = act;
  if (joining.length + saved.length + liked.length === 0) return null;

  return (
    <div
      className="rounded-2xl border border-border p-4 space-y-3"
      style={{ background: "rgb(var(--surface-rgb))" }}
    >
      {/* アイコン横並び ＋ テキスト */}
      {joining.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            {joining.slice(0, 3).map((f, i) => (
              <div
                key={f.name}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2"
                style={{
                  marginLeft: i > 0 ? -8 : 0,
                  zIndex: 3 - i,
                  borderColor: "rgb(var(--bg-rgb))",
                  background: "rgb(var(--surface-rgb))",
                }}
              >
                {f.avatar}
              </div>
            ))}
          </div>
          <p className="text-[13px] text-fore flex-1 leading-snug">
            {buildJoiningText(joining)}
          </p>
        </div>
      )}

      {/* カウントバッジ行 */}
      <div className="flex flex-wrap gap-2">
        {joining.length > 0 && (
          <span
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(230,57,70,0.1)", color: "#E63946", border: "1px solid rgba(230,57,70,0.2)" }}
          >
            👥 Attending
          </span>
        )}
        {saved.length > 0 && (
          <span
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(80,160,255,0.1)", color: "#50A0FF", border: "1px solid rgba(80,160,255,0.2)" }}
          >
            🔖 Saved
          </span>
        )}
        {liked.length > 0 && (
          <span
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(255,100,150,0.1)", color: "#FF6496", border: "1px solid rgba(255,100,150,0.2)" }}
          >
            ❤️ Interested
          </span>
        )}
      </div>
    </div>
  );
}

// ── InfoRow サブコンポーネント ────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-fore leading-snug">{value}</p>
      </div>
    </div>
  );
}
