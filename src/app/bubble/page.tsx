"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ReactionFloatingEffect from "@/components/ReactionFloatingEffect";
import SyncLogo from "@/components/SyncLogo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// ── GPS距離計算 ──────────────────────────────────────────────────────────

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── 時間帯背景 ──────────────────────────────────────────────────────────

type ToD = "morning" | "day" | "evening" | "night";

const TIME_BG: Record<ToD, string> = {
  morning: "linear-gradient(185deg,#3A8CC0 0%,#70B8DA 16%,#F8CE70 42%,#FFC090 62%,#FFE4CC 82%,#FFF8F0 100%)",
  day:     "linear-gradient(180deg,#0C5A9C 0%,#2880BC 22%,#4CAAD8 48%,#94CDE8 72%,#D4ECFA 90%,#EEF8FF 100%)",
  evening: "linear-gradient(185deg,#040114 0%,#180448 12%,#560878 28%,#B0165A 50%,#E43018 68%,#F87028 84%,#FFAE40 100%)",
  night:   "linear-gradient(190deg,#010108 0%,#030318 28%,#070540 58%,#040320 80%,#010108 100%)",
};

const getToD = (h: number): ToD =>
  h >= 5 && h < 10 ? "morning" : h >= 10 && h < 17 ? "day" : h >= 17 && h < 20 ? "evening" : "night";


// ── 定数 ────────────────────────────────────────────────────────────────

const LANE_COUNT       = 7;
const MAX_BUBBLES      = 49;
const MAX_CHARS        = 15;
const INPUT_H          = 68;
const BUBBLE_LIFETIME  = 20;      // 秒
const DANGER_THRESHOLD = 5;       // 残り5秒で消滅予兆
const RESTITUTION      = 0.4;     // 左右壁バウンド係数
const BUBBLE_H         = 40;      // バブル高さ概算（px）
const HEADER_H         = 48;      // ヘッダー高さ（px）
let BURST_LINE_Y       = 60;      // 破裂ライン（画面上端からのpx）— ヘッダー高さで動的に更新
const SAFE_MARGIN      = 80;      // レーン内重なり防止マージン（px）
const LANE_SAFE_SEC    = 2.0;     // 同じ列に出す最小間隔（秒）

// 7列レーン（幅比率）
const LANES = [0.06, 0.20, 0.34, 0.48, 0.62, 0.76, 0.90];

// 開発用：自動バブル生成（本番では false にする）
const DEV_AUTO_SPAWN = false;

const REACTION_MESSAGES = [
  "一期一会",
  "記憶が弾けた",
  "泡が昇華した…",
  "また会いましょう",
  "消えゆく瞬間…",
  "パチン！",
];

const REACT_EMOJIS = ["❤️", "😂", "😮", "😢", "👏"];

const RANDOM_BORDER_COLORS = [
  '#E84040', // 赤
  '#E8A020', // オレンジ
  '#48C468', // 緑
  '#2890D8', // 青
  '#7C6FE8', // 紫
  '#D455A8', // ピンク
  '#20C8C8', // シアン
  '#E8C820', // 黄
];

function getRandomBorderColor(): string {
  return RANDOM_BORDER_COLORS[Math.floor(Math.random() * RANDOM_BORDER_COLORS.length)];
}

// ── 型定義 ──────────────────────────────────────────────────────────────

interface Bubble {
  id:        string;
  text:      string;
  avatar:    string;
  handle:    string;
  isOwn:     boolean;
  lane:      number;
  left:      number;
  width:     number;
  createdAt: number;  // Date.now() at spawn（壁時計）
  vx:        number;
  vy:        number;
  timeLeft:  number;
  x:         number;
  y:         number;
  textColor:   string;
  paused:      boolean;
  borderColor?: string;
}

interface PopBurst {
  id:        string;
  x:         number;
  y:         number;
  particles: Array<{ id: number; dx: string; dy: string; size: number }>;
}

interface BurstMessage {
  id:   number;
  x:    number;
  y:    number;
  text: string;
}

interface FloatingEmoji {
  id:     number;
  left:   number;   // % (bottom起点モード用)
  emoji:  string;
  size:   number;
  delay:  number;
  fieldX?: number;  // px (フィールド座標モード)
  fieldY?: number;  // px (フィールド座標モード)
}

// ── ヘルパー ────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).slice(2, 9);

// ── BubbleItem ──────────────────────────────────────────────────────────

function BubbleItem({ b, onTap, onQuickLike, setRef, timeLeft, isLiked, reactionEmoji, bubbleBorderColor }: {
  b:                 Bubble;
  onTap:             (clientX: number, clientY: number) => void;
  onQuickLike:       () => void;
  setRef:            (el: HTMLDivElement | null) => void;
  timeLeft:          number;
  isLiked:           boolean;
  reactionEmoji:     string;
  bubbleBorderColor: string;
}) {
  const [isNew, setIsNew]       = useState(true);
  const physicsInitRef           = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setIsNew(false), 400);
    return () => clearTimeout(t);
  }, []);

  const isDanger = timeLeft <= DANGER_THRESHOLD;

  return (
    <div
      ref={el => {
        if (el && !physicsInitRef.current) {
          // b.y はコンテナ座標 → フィールド div 内 translate に変換
          el.style.transform = `translate(${b.x}px, ${b.y - HEADER_H}px)`;
          physicsInitRef.current = true;
        }
        setRef(el);
      }}
      style={{
        position:   "absolute",
        top:        0,
        left:       0,
        width:      b.width,
        zIndex:     10,
        willChange: "transform",
        cursor:     b.isOwn ? "default" : "pointer",
        pointerEvents: b.isOwn ? "none" : "auto",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
      onClick={b.isOwn ? undefined : e => onTap(e.clientX, e.clientY)}
    >
      {/* 出現アニメーション + 危険時グロー */}
      <div style={{
        animation: isNew ? "bubbleSpawn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
        filter:    isDanger ? "drop-shadow(0 0 8px rgba(255,255,255,0.9))" : "none",
        transition:"filter 0.3s ease",
      }}>
        {/* バブル本体 */}
        <div style={{
          position:             "relative",
          display:              "flex",
          alignItems:           "center",
          gap:                  6,
          padding:              "5px 8px 5px 5px",
          background:           "rgba(255,255,255,0.08)",
          borderRadius:         20,
          ...((() => {
            const borderColor = b.isOwn
              ? bubbleBorderColor
              : (b.borderColor ?? '#E84040');
            return {
              border: borderColor === 'rainbow'
                ? '1.5px solid transparent'
                : borderColor === 'transparent'
                  ? 'none'
                  : `1.5px solid ${borderColor}`,
              borderImage: borderColor === 'rainbow'
                ? 'linear-gradient(to right,#7C6FE8,#D455A8,#E84040,#E8A020,#48C468,#2890D8) 1'
                : 'none',
            };
          })()),
          boxShadow:            "inset 0 1px 2px rgba(255,255,255,0.15)",
          animation:            isDanger ? "pururu 0.4s ease-in-out infinite" : "none",
          backdropFilter:       "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          overflow:             "hidden",
        }}>
          {/* 光沢ハイライト */}
          <div style={{
            position:     "absolute",
            top:          3,
            left:         6,
            width:        "25%",
            height:       "50%",
            borderRadius: "50%",
            background:   "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)",
            pointerEvents:"none",
          }} />
          {/* ユーザーアイコン（左端） */}
          {!b.isOwn && (
            <div style={{
              width:          24,
              height:         24,
              borderRadius:   "50%",
              background:     "rgba(255,26,26,0.15)",
              border:         "1px solid rgba(255,26,26,0.35)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       13,
              flexShrink:     0,
              lineHeight:     1,
            }}>
              {b.avatar}
            </div>
          )}
          <span style={{
            flex:         1,
            minWidth:     0,
            fontSize:     11,
            fontWeight:   600,
            color:        b.textColor,
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            letterSpacing:"0.01em",
          }}>
            {b.text}
          </span>
          {/* 👍 ワンタップリアクションボタン */}
          {!b.isOwn && (
            <div
              onClick={e => { e.stopPropagation(); onQuickLike(); }}
              style={{
                marginLeft:              2,
                width:                   26,
                height:                  26,
                borderRadius:            "50%",
                background:              isLiked ? "rgba(255,26,26,0.28)" : "rgba(255,255,255,0.06)",
                border:                  isLiked ? "1px solid rgba(255,26,26,0.60)" : "1px solid rgba(255,255,255,0.14)",
                boxShadow:               isLiked ? "0 0 8px rgba(255,26,26,0.50)" : "none",
                display:                 "flex",
                alignItems:              "center",
                justifyContent:          "center",
                fontSize:                12,
                flexShrink:              0,
                cursor:                  "pointer",
                transition:              "background 0.2s, border 0.2s, box-shadow 0.2s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {reactionEmoji}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── アクションメニュー（タップ） ─────────────────────────────────────────

interface ActionMenuState {
  bubbleId: string;
  bubble:   Bubble;
  clientX:  number;
  clientY:  number;
}

interface DMSheetState {
  bubbleId: string;
  userName: string;
  userIcon: string;
}

const ACTION_MENU_W = 264;

function BubbleActionMenu({ menu, onReact, onDm, onProfile, onClose }: {
  menu:      ActionMenuState;
  onReact:   (emoji: string) => void;
  onDm:      () => void;
  onProfile: () => void;
  onClose:   () => void;
}) {
  const t = useTranslations('bubble');
  const vw = typeof window !== "undefined" ? window.innerWidth  : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 844;
  const MARGIN = 10;
  const CARD_H = 216;

  let left = menu.clientX - ACTION_MENU_W / 2;
  let top  = menu.clientY - CARD_H - 14;
  if (top < 56)                top = menu.clientY + 14;
  if (top + CARD_H > vh - 80) top = vh - CARD_H - 90;
  left = Math.max(MARGIN, Math.min(left, vw - ACTION_MENU_W - MARGIN));

  return (
    <>
      {/* 透明オーバーレイ */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 28 }}
        onClick={onClose}
      />
      {/* カード本体 */}
      <div
        style={{
          position:             "fixed",
          left,
          top,
          width:                ACTION_MENU_W,
          zIndex:               29,
          background:           "#0d0d1a",
          border:               "0.5px solid rgba(255,26,26,0.32)",
          borderRadius:         20,
          padding:              "14px",
          boxShadow:            "0 8px 36px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(255,255,255,0.05)",
          backdropFilter:       "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          animation:            "menuPopIn 0.18s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ユーザー情報 */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div style={{
            width:24, height:24, borderRadius:"50%",
            background:"rgba(255,26,26,0.15)", border:"1px solid rgba(255,26,26,0.35)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0,
          }}>
            {menu.bubble.avatar}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#FF1A1A", lineHeight:1.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {menu.bubble.text.slice(0, 14)}
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.38)", lineHeight:1.2 }}>
              バブル
            </div>
          </div>
        </div>

        {/* リアクション行（28px・44pxタップ領域・12px gap） */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
          {REACT_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact(emoji); onClose(); }}
              style={{
                flex:1, height:44, border:"1px solid rgba(255,255,255,0.10)",
                borderRadius:12, background:"rgba(255,255,255,0.06)",
                fontSize:28, display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", WebkitTapHighlightColor:"transparent",
                transition:"transform 0.12s ease, background 0.12s ease",
              }}
              onPointerEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(255,255,255,0.13)"; b.style.transform = "scale(1.18)"; }}
              onPointerLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(255,255,255,0.06)"; b.style.transform = "scale(1)"; }}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* DM を送る */}
        <button
          onClick={onDm}
          style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 12px", borderRadius:12, marginBottom:8, background:"rgba(17,138,178,0.10)", border:"1px solid rgba(17,138,178,0.22)", cursor:"pointer", WebkitTapHighlightColor:"transparent", boxSizing:"border-box" }}
        >
          <span style={{ fontSize:15 }}>✉️</span>
          <span style={{ fontSize:13, fontWeight:600, color:"#118AB2" }}>{t('sendDm')}</span>
        </button>

        {/* プロフィールを見る */}
        <button
          onClick={onProfile}
          style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 12px", borderRadius:12, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)", cursor:"pointer", WebkitTapHighlightColor:"transparent", boxSizing:"border-box" }}
        >
          <span style={{ fontSize:15 }}>👤</span>
          <span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.80)" }}>{t('viewProfile')}</span>
        </button>
      </div>
    </>
  );
}

// ── DMシート ───────────────────────────────────────────────────────────

function DMSheet({ state, message, onMessageChange, onSend, onClose }: {
  state:           DMSheetState;
  message:         string;
  onMessageChange: (v: string) => void;
  onSend:          () => void;
  onClose:         () => void;
}) {
  const t = useTranslations('bubble');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  function triggerClose() {
    setClosing(true);
    setTimeout(onClose, 200);
  }

  return (
    <>
      {/* 背景オーバーレイ */}
      <div
        style={{ position:"fixed", inset:0, zIndex:45, background:"rgba(0,0,0,0.50)" }}
        onClick={triggerClose}
      />
      {/* シート本体 */}
      <div
        style={{
          position:       "fixed",
          bottom:         0,
          left:           "50%",
          transform:      "translateX(-50%)",
          width:          375,
          zIndex:         46,
          background:     "#0d0d1a",
          borderTop:      "0.5px solid rgba(255,26,26,0.30)",
          borderRadius:   "24px 24px 0 0",
          padding:        "0 0 env(safe-area-inset-bottom, 0)",
          boxShadow:      "0 -8px 40px rgba(0,0,0,0.70)",
          animation:      closing ? "dmSlideOut 0.20s ease-in forwards" : "dmSlideUp 0.30s cubic-bezier(0.32,0.72,0,1) forwards",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ハンドル */}
        <div style={{ display:"flex", justifyContent:"center", paddingTop:10 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"rgba(255,255,255,0.18)" }} />
        </div>

        {/* ヘッダー */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px 8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:20 }}>{state.userIcon}</span>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.60)" }}>
              <span style={{ color:"#FF1A1A", fontWeight:700 }}>@{state.userName}</span>
              {t('dmTo')}
            </span>
          </div>
          <button
            onClick={triggerClose}
            style={{
              width:28, height:28, borderRadius:"50%", border:"none",
              background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.55)",
              fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              WebkitTapHighlightColor:"transparent",
            }}
          >
            ✕
          </button>
        </div>

        {/* テキストエリア */}
        <div style={{ padding:"0 16px 12px" }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => onMessageChange(e.target.value)}
            placeholder={t('messagePlaceholder')}
            rows={4}
            style={{
              width:              "100%",
              background:         "rgba(255,255,255,0.06)",
              border:             "0.5px solid rgba(255,255,255,0.12)",
              borderRadius:       14,
              padding:            "12px 14px",
              fontSize:           14,
              color:              "#fff",
              resize:             "none",
              outline:            "none",
              fontFamily:         "inherit",
              lineHeight:         1.55,
              boxSizing:          "border-box",
            }}
          />
        </div>

        {/* 送信ボタン */}
        <div style={{ padding:"0 16px 24px", display:"flex", justifyContent:"flex-end" }}>
          <button
            onClick={onSend}
            disabled={!message.trim()}
            style={{
              height:       40,
              padding:      "0 24px",
              borderRadius: 20,
              border:       "none",
              cursor:       message.trim() ? "pointer" : "default",
              background:   message.trim() ? "linear-gradient(135deg,#FF1A1A,#8B0000)" : "rgba(255,26,26,0.18)",
              color:        message.trim() ? "#0d0d1a" : "rgba(255,26,26,0.38)",
              fontSize:     14,
              fontWeight:   700,
              letterSpacing:"0.04em",
              transition:   "all 0.18s",
              boxShadow:    message.trim() ? "0 0 12px rgba(255,26,26,0.35)" : "none",
              WebkitTapHighlightColor:"transparent",
            }}
          >
            {t('send')}
          </button>
        </div>
      </div>
    </>
  );
}

// ── ライブ設計：時間はコンポーネント外でも進み続ける ──────────────────────

/** アプリ起動時点の壁時計（ページリロードでリセット） */
const LIVE_START_TIME = Date.now();

type PhysicsState = {
  x: number; y: number; vx: number; vy: number;
  timeLeft: number; width: number; isOwn: boolean; lane: number; paused: boolean;
  createdAt: number;       // Date.now() at spawn（壁時計）
  pausedElapsed: number;   // 累積 pause 秒数
  pausedAt: number | null; // Date.now() at pause start（壁時計）
};

let _savedBubbles: Bubble[]                  = [];
let _savedPhysics: Map<string, PhysicsState> = new Map();
let _savedEmojiId                            = 0;
let _savedMsgId                              = 0;
let _savedLaneLastUsed: number[]             = new Array(LANE_COUNT).fill(0);
let _lastUnmountTime                         = 0; // Date.now() at last unmount
let _lastVisitTime                           = Date.now(); // タブ切り替え追跡用

// ── メインコンポーネント ────────────────────────────────────────────────

export default function BubblePage() {
  const t = useTranslations('bubble');
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [tod,           setTod]          = useState<ToD>(() => getToD(new Date().getHours()));
  const [bubbles,       setBubbles]      = useState<Bubble[]>([]);
  const [popBursts,     setPopBursts]    = useState<PopBurst[]>([]);
  const [burstMessages, setBurstMessages]= useState<BurstMessage[]>([]);
  const [floatingEmojis,setFloatingEmojis]=useState<FloatingEmoji[]>([]);
  const [actionMenu,      setActionMenu]     = useState<ActionMenuState | null>(null);
  const [likedBubbleIds,  setLikedBubbleIds] = useState<Set<string>>(new Set());
  const [reactionEmoji,   setReactionEmoji]  = useState<string>('👍');
  const [focusedBubbleId, setFocusedBubbleId]= useState<string | null>(null);
  const [input,           setInput]          = useState("");
  const [dmSheet,         setDmSheet]        = useState<DMSheetState | null>(null);
  const [dmMessage,       setDmMessage]      = useState("");
  const [toastMsg,        setToastMsg]       = useState<string | null>(null);
  const [postCount,       setPostCount]      = useState(0);
  const [viewerCount,     setViewerCount]    = useState(0);
  const [bubbleBorderColor, setBubbleBorderColor] = useState('#FF1A1A');

  const laneLastUsedRef  = useRef<number[]>(new Array(LANE_COUNT).fill(0));
  const bubblesRef       = useRef<Bubble[]>([]);
  const emojiIdRef       = useRef(0);
  const msgIdRef         = useRef(0);
  const lastReactionMsgIdx = useRef(-1);
  const fieldRef         = useRef<HTMLDivElement>(null);
  const physicsRef       = useRef<Map<string, PhysicsState>>(new Map());
  const bubbleDivRefs    = useRef<Map<string, HTMLDivElement>>(new Map());
  const bubbleTimesRef   = useRef<Map<string, number>>(new Map());
  const [bubbleTimes,   setBubbleTimes]  = useState<Map<string, number>>(new Map());
  const [fading,        setFading]       = useState<{ gradient: string; opaque: boolean } | null>(null);
  const todPrevRef       = useRef<ToD>(getToD(new Date().getHours()));
  const triggerPopBurstRef   = useRef<(x: number, y: number) => void>(() => {});
  const focusedBubbleIdRef   = useRef<string | null>(null);
  const audioCtxRef          = useRef<AudioContext | null>(null);
  const playSoundRef     = useRef({ spawn: () => {}, burst: () => {} });
  const catchUpFnRef     = useRef<(elapsedSec: number) => void>(() => {});
  const headerRef        = useRef<HTMLDivElement>(null);

  // ヘッダー高さを動的に取得して BURST_LINE_Y を更新
  useEffect(() => {
    if (headerRef.current) {
      BURST_LINE_Y = headerRef.current.offsetHeight;
    }
  }, []);

  // viewerCount: マウント時にクライアントサイドでのみ初期値セット → Hydrationエラー回避
  useEffect(() => {
    setViewerCount(50 + Math.floor(Math.random() * 451));
  }, []);

  // viewerCount ゆっくり増減
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => {
        if (prev === 0) return prev; // 初期化前は更新しない
        const delta     = Math.floor(Math.random() * 5) + 1;
        const direction = Math.random() > 0.5 ? 1 : -1;
        return Math.min(500, Math.max(5, prev + delta * direction));
      });
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  // bubble_style をlocalStorageから読み込んで枠色に反映（ページロード時1回）
  useEffect(() => {
    const raw = localStorage.getItem('bubble_style');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.borderColor === 'none') {
          setBubbleBorderColor('transparent');
        } else if (parsed.borderColor) {
          setBubbleBorderColor(parsed.borderColor);
        }
      } catch { /* ignore */ }
    }
  }, []);

  // リアクション絵文字をlocalStorageから読み込む
  useEffect(() => {
    const stored = localStorage.getItem('sync_reaction_emoji');
    if (stored) setReactionEmoji(stored);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sync_reaction_emoji') setReactionEmoji(e.newValue ?? '👍');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // マウント時：ライブ状態を復元（離れていた時間も時間が進んでいる）
  useEffect(() => {
    emojiIdRef.current      = _savedEmojiId;
    msgIdRef.current        = _savedMsgId;
    laneLastUsedRef.current = [..._savedLaneLastUsed];

    if (_savedBubbles.length > 0) {
      const now      = Date.now();
      const awaySec  = _lastUnmountTime > 0 ? (now - _lastUnmountTime) / 1000 : 0;
      const alive: Bubble[] = [];

      _savedBubbles.forEach(b => {
        const age = (now - b.createdAt) / 1000;
        if (age >= BUBBLE_LIFETIME) return; // ライブ中に寿命が尽きたバブル

        const s = _savedPhysics.get(b.id);
        if (!s) return;

        // 離れていた時間分だけ y 座標を進める（vy は定速上昇）
        const advancedY = s.y + s.vy * awaySec;
        if (advancedY <= BURST_LINE_Y) return; // 既に破裂ラインを超えていた

        physicsRef.current.set(b.id, {
          ...s,
          y:        advancedY,
          timeLeft: BUBBLE_LIFETIME - age + s.pausedElapsed,
          paused:   false,
          pausedAt: null,
        });
        alive.push(b);
      });

      if (alive.length > 0) setBubbles(alive);

      // キャッチアップ：catchUpFnRef が設定されてから呼ぶ（0ms遅延）
      if (awaySec > 2) {
        setTimeout(() => catchUpFnRef.current(awaySec), 0);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // アンマウント時：ライブ状態を保存
  useEffect(() => {
    return () => {
      _savedBubbles      = [...bubblesRef.current];
      _savedPhysics      = new Map(physicsRef.current);
      _savedEmojiId      = emojiIdRef.current;
      _savedMsgId        = msgIdRef.current;
      _savedLaneLastUsed = [...laneLastUsedRef.current];
      _lastUnmountTime   = Date.now();
      _lastVisitTime     = Date.now();
    };
  }, []);

  // catchUpFnRef（タブ復帰時キャッチアップ）— モックデータ廃止につきno-op
  useEffect(() => {
    catchUpFnRef.current = (_elapsedSec: number) => { /* no-op */ };
  });

  // タブ切り替え・画面ロック時のライブ感維持（visibilitychange）
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === 'visible') {
        const now     = Date.now();
        const elapsed = (now - _lastVisitTime) / 1000;
        _lastVisitTime = now;
        if (elapsed > 2) catchUpFnRef.current(elapsed);
      } else {
        // 画面を離れる瞬間の時刻を記録
        _lastVisitTime = Date.now();
      }
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);

  // 星・大気（クライアントサイドのみ生成）
  const MICRO  = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ id:i,   left:(Math.sin(i*7.391)*0.5+0.5)*100, top:(Math.sin(i*3.714+1.2)*0.5+0.5)*90, size:0.5+(i%3)*0.18, op:0.10+(i%8)*0.05,  dur:4+(i%7)*0.7,  delay:(i%17)*0.31 })), []);
  const NORMAL = useMemo(() => Array.from({ length: 50 }, (_, i) => ({ id:100+i, left:(Math.sin(i*5.123+0.5)*0.5+0.5)*100, top:(Math.sin(i*2.841+2.8)*0.5+0.5)*88, size:1+(i%4)*0.32, op:0.32+(i%6)*0.09, dur:2.8+(i%9)*0.42, delay:(i%11)*0.42 })), []);
  const BRIGHT = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ id:155+i, left:(Math.sin(i*9.432+1.8)*0.5+0.5)*100, top:(Math.sin(i*4.567+0.3)*0.5+0.5)*80, size:1.9+(i%4)*0.38, op:0.6+(i%4)*0.08,  dur:2.2+(i%8)*0.35, delay:(i%13)*0.52 })), []);
  const NEBULA = useMemo(() => Array.from({ length: 6  }, (_, i) => ({ id:i, left:(Math.sin(i*4.123+0.7)*0.5+0.5)*100, top:(Math.sin(i*2.987+1.4)*0.5+0.5)*85, size:90+(i%4)*62, color:["rgba(70,30,160,0.055)","rgba(30,18,110,0.045)","rgba(90,50,190,0.06)","rgba(18,25,100,0.05)","rgba(50,18,130,0.045)","rgba(70,50,190,0.065)"][i] })), []);
  const CLOUDS = useMemo(() => Array.from({ length: 7  }, (_, i) => ({ id:i, left:(Math.sin(i*6.28+0.4)*0.5+0.5)*100, top:20+(Math.sin(i*3.14+1.1)*0.5+0.5)*55, w:100+(i%4)*55, h:26+(i%3)*12 })), []);

  // bubblesRef 同期
  useEffect(() => { bubblesRef.current = bubbles; }, [bubbles]);

  // focusedBubbleIdRef 同期（RAF ループから参照するため）
  useEffect(() => { focusedBubbleIdRef.current = focusedBubbleId; }, [focusedBubbleId]);

  // フォーカス演出：DOM を直接操作（Reactの再レンダーを避けるため）
  useEffect(() => {
    bubbleDivRefs.current.forEach((el, id) => {
      el.style.transition = "filter 0.3s ease, opacity 0.3s ease";
      if (focusedBubbleId === null) {
        el.style.filter  = "";
        el.style.opacity = "";
        el.style.zIndex  = "";
      } else if (id === focusedBubbleId) {
        el.style.filter  = "drop-shadow(0 0 12px rgba(255,26,26,0.8))";
        el.style.opacity = "1";
        el.style.zIndex  = "35";
      } else {
        el.style.filter  = "blur(2px)";
        el.style.opacity = "0.4";
        el.style.zIndex  = "";
      }
    });
  }, [focusedBubbleId]);

  // bubbleTimes を 1秒ごとにスナップショット（BubbleItem の isDanger 更新用）
  useEffect(() => {
    const id = setInterval(() => {
      setBubbleTimes(new Map(bubbleTimesRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // 時間帯遷移（1分ごと）
  useEffect(() => {
    const check = () => {
      const newTod = getToD(new Date().getHours());
      if (newTod === todPrevRef.current) return;
      const oldGrad = TIME_BG[todPrevRef.current];
      todPrevRef.current = newTod;
      setFading({ gradient: oldGrad, opaque: true });
      setTod(newTod);
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setFading(f => f ? { ...f, opaque: false } : null)
        )
      );
      setTimeout(() => setFading(null), 122_000);
    };
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Web Audio ─────────────────────────────────────────────────────────

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { return; }
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const getRunningCtx = useCallback((): AudioContext | null => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "running") return null;
    return ctx;
  }, []);

  const playSpawnSound = useCallback(() => {
    const ctx = getRunningCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.1);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.start(t); osc.stop(t + 0.12);
  }, [getRunningCtx]);

  const playBurstSound = useCallback(() => {
    const ctx = getRunningCtx();
    if (!ctx) return;
    const t   = ctx.currentTime;
    const sz  = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, sz, ctx.sampleRate);
    const dat = buf.getChannelData(0);
    for (let i = 0; i < sz; i++) dat[i] = (Math.random() * 2 - 1) * (1 - i / sz);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const ng = ctx.createGain();
    src.connect(ng); ng.connect(ctx.destination);
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.start(t);
    const osc = ctx.createOscillator();
    const og  = ctx.createGain();
    osc.connect(og); og.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.1);
    og.gain.setValueAtTime(0.3, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.start(t); osc.stop(t + 0.12);
  }, [getRunningCtx]);

  useEffect(() => {
    playSoundRef.current = { spawn: playSpawnSound, burst: playBurstSound };
  }, [playSpawnSound, playBurstSound]);

  useEffect(() => {
    const activate = () => {
      ensureAudio();
      window.removeEventListener("pointerdown", activate, true);
      window.removeEventListener("touchstart",  activate, true);
      window.removeEventListener("keydown",     activate, true);
    };
    window.addEventListener("pointerdown", activate, true);
    window.addEventListener("touchstart",  activate, true);
    window.addEventListener("keydown",     activate, true);
    return () => {
      window.removeEventListener("pointerdown", activate, true);
      window.removeEventListener("touchstart",  activate, true);
      window.removeEventListener("keydown",     activate, true);
    };
  }, [ensureAudio]);

  // ── 破裂エフェクト ───────────────────────────────────────────────────

  const triggerPopBurst = useCallback((x: number, y: number) => {
    playSoundRef.current.burst();

    // 12個ゴールドパーティクル、360度放射、600ms（テキストなし）
    const particles = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const dist  = 20 + Math.random() * 30;
      return {
        id:   i,
        dx:   (Math.cos(angle) * dist).toFixed(1) + "px",
        dy:   (Math.sin(angle) * dist).toFixed(1) + "px",
        size: 3 + Math.random() * 3,
      };
    });
    const burst: PopBurst = { id: makeId(), x, y, particles };
    setPopBursts(prev => [...prev, burst]);
    setTimeout(() => setPopBursts(prev => prev.filter(b => b.id !== burst.id)), 700);
  }, []);

  useEffect(() => { triggerPopBurstRef.current = triggerPopBurst; }, [triggerPopBurst]);

  // ── 物理演算ループ ───────────────────────────────────────────────────

  useEffect(() => {
    let rafId: number;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const fw = fieldRef.current?.offsetWidth ?? 375;
      const toFade: string[] = [];

      physicsRef.current.forEach((state, id) => {
        // 壁時計（Date.now）ベースで timeLeft を計算（pause中の経過を除外）
        const wallNow    = Date.now();
        const pausedTotal = state.paused && state.pausedAt != null
          ? state.pausedElapsed + (wallNow - state.pausedAt) / 1000
          : state.pausedElapsed;
        state.timeLeft = BUBBLE_LIFETIME - (wallNow - state.createdAt) / 1000 + pausedTotal;
        bubbleTimesRef.current.set(id, state.timeLeft);

        // 座標ベース破裂判定: state.y はコンテナ座標 → BURST_LINE_Y と直接比較
        // timeLeft <= 0 は安全網（通常は座標判定が先に発火）
        if (state.y <= BURST_LINE_Y || state.timeLeft <= 0) {
          toFade.push(id);
          return;
        }

        // paused中は位置・速度を一切更新しない
        if (state.paused) return;

        // 上昇（vy は生成時に固定、変化しない）
        state.y += state.vy * dt;

        // 水平ゆらぎ（vxの自然減衰）
        state.vx *= Math.pow(0.98, dt * 60);
        state.x  += state.vx * dt;

        // 左右壁バウンド（restitution = 0.4、上下バウンドなし）
        if (state.x < 0) {
          state.x  = 0;
          state.vx = Math.abs(state.vx) * RESTITUTION;
        }
        if (state.x + state.width > fw) {
          state.x  = fw - state.width;
          state.vx = -Math.abs(state.vx) * RESTITUTION;
        }
      });

      // DOM反映（focusedバブルには scale(1.05) を付与）
      physicsRef.current.forEach((state, id) => {
        if (toFade.includes(id)) return;
        if (state.paused) return; // paused中はtransformを触らない
        const el = bubbleDivRefs.current.get(id);
        if (!el) return;
        const scale = id === focusedBubbleIdRef.current ? " scale(1.05)" : "";
        // state.y はコンテナ座標 → フィールド div 内 translate に変換（HEADER_H を引く）
        el.style.transform = `translate(${state.x}px, ${state.y - HEADER_H}px)${scale}`;
      });

      // 破裂処理（即時パチン！）
      if (toFade.length > 0) {
        toFade.forEach(id => {
          if (!physicsRef.current.has(id)) return;
          const state = physicsRef.current.get(id)!;
          // 破裂エフェクト座標はゴールドラインに固定（コンテナ座標）
          triggerPopBurstRef.current(
            state.x + state.width / 2,
            BURST_LINE_Y,
          );
          physicsRef.current.delete(id);
          bubbleTimesRef.current.delete(id);
          // パチン！アニメーション（scale 1.3 → 0 の 0.3s pop）
          const el = bubbleDivRefs.current.get(id);
          if (el) {
            el.style.animation    = "bubblePop 0.3s ease-out forwards";
            el.style.pointerEvents = "none";
          }
        });
        // アニメーション完了後にDOMから削除（0.35s）
        const fadeCopy = [...toFade];
        setTimeout(() => {
          fadeCopy.forEach(id => bubbleDivRefs.current.delete(id));
          setBubbles(prev => prev.filter(b => !fadeCopy.includes(b.id)));
        }, 350);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ── レーン割り当て ────────────────────────────────────────────────────

  const assignLane = useCallback((W: number, spawnY: number, bubbleW: number = 160): { laneIdx: number; x: number } => {
    const now     = Date.now();
    const safeSec = LANE_SAFE_SEC * 1000;

    const laneBottomY = new Array(LANE_COUNT).fill(Infinity);
    physicsRef.current.forEach(state => {
      const lane = state.lane;
      if (state.y > (laneBottomY[lane] === Infinity ? -Infinity : laneBottomY[lane])) {
        laneBottomY[lane] = state.y;
      }
    });

    const waits = laneLastUsedRef.current.map((t, i) => ({ i, wait: now - t }));
    const safe  = waits.filter(l =>
      l.wait >= safeSec &&
      (laneBottomY[l.i] === Infinity || laneBottomY[l.i] < spawnY - (BUBBLE_H + SAFE_MARGIN))
    );
    const best = (safe.length > 0 ? safe : waits)
      .reduce((a, b) => a.wait > b.wait ? a : b);

    laneLastUsedRef.current[best.i] = now;

    const baseX  = LANES[best.i] * W;
    const jitter = (Math.random() - 0.5) * 20;
    const x      = Math.max(10, Math.min(W - bubbleW - 10, baseX + jitter));

    return { laneIdx: best.i, x };
  }, []);

  // ── Bubble追加 ────────────────────────────────────────────────────────

  const addBubble = useCallback((text: string, isOwn: boolean, avatar?: string) => {
    if (!text.trim()) return;

    const fw    = fieldRef.current?.offsetWidth  ?? 375;
    const fh    = fieldRef.current?.offsetHeight ?? 600;
    const width = 154 + Math.floor(Math.random() * 25); // 154〜178px

    // initY をコンテナ座標（outer div 上端からの距離）で管理する
    const initY = HEADER_H + fh - INPUT_H - BUBBLE_H;
    const { laneIdx, x: initX } = assignLane(fw, initY, width);
    const initVx = (Math.random() - 0.5) * 40;
    // 20秒でちょうどBURST_LINE_Y（コンテナ座標）に到達する速度（px/s）
    // speed = (startY - BURST_LINE_Y) / (20 * 60) [px/frame @60fps] と等価
    const initVy = -((initY - BURST_LINE_Y) / BUBBLE_LIFETIME);
    const id     = makeId();

    const b: Bubble = {
      id,
      text:      text.trim(),
      avatar:    avatar ?? (isOwn ? "🌟" : "👤"),
      handle:    isOwn ? 'you' : 'user',
      isOwn,
      lane:      laneIdx,
      left:      fw > 0 ? (initX / fw) * 100 : 5,
      width,
      createdAt: Date.now(),
      vx:        initVx,
      vy:        initVy,
      timeLeft:  BUBBLE_LIFETIME,
      x:         initX,
      y:         initY,
      textColor:   "#FFFFFF",
      paused:      false,
      borderColor: isOwn ? undefined : getRandomBorderColor(),
    };

    physicsRef.current.set(id, {
      x: initX, y: initY, vx: initVx, vy: initVy,
      timeLeft: BUBBLE_LIFETIME, width, isOwn, lane: laneIdx, paused: false,
      createdAt: Date.now(), pausedElapsed: 0, pausedAt: null,
    });
    playSoundRef.current.spawn();

    // FIFO: MAX_BUBBLES超過時は最古に bubblePop を適用してから削除
    const currentBubbles = bubblesRef.current;
    if (currentBubbles.length >= MAX_BUBBLES) {
      const oldest = currentBubbles[0];
      const oldEl  = bubbleDivRefs.current.get(oldest.id);
      if (oldEl) {
        oldEl.style.animation    = "bubblePop 0.3s ease-out forwards";
        oldEl.style.pointerEvents = "none";
      }
      physicsRef.current.delete(oldest.id);
      bubbleTimesRef.current.delete(oldest.id);
      setTimeout(() => {
        bubbleDivRefs.current.delete(oldest.id);
        setBubbles(prev => prev.filter(p => p.id !== oldest.id));
      }, 350);
      // 新バブルは即座に追加（削除アニメーション完了を待たない）
      setBubbles(prev => [...prev, b]);
    } else {
      setBubbles(prev => [...prev, b]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignLane]);

  const addBubbleRef = useRef(addBubble);
  useEffect(() => { addBubbleRef.current = addBubble; }, [addBubble]);

  // ゲストモード: ユーザー未ログイン時にモックバブルを初期表示
  useEffect(() => {
    console.log('ゲストuseEffect発火', { loading, user });
    if (loading) return;
    if (user !== null) return;

    // DOMマウント後に実行するため少し遅延
    const timer = setTimeout(() => {
      console.log('タイマー発火', {
        fw: fieldRef.current?.offsetWidth,
        fh: fieldRef.current?.offsetHeight,
        fieldRef: fieldRef.current,
      });
      const fw = fieldRef.current?.offsetWidth  ?? 375;
      const fh = fieldRef.current?.offsetHeight ?? 600;

      // fw または fh が 0 の場合はデフォルト値を使用
      const safefw = fw > 0 ? fw : 375;
      const safefh = fh > 0 ? fh : 600;

      const MOCK_DATA = [
        { text: '今日のランチ美味しかった🍜', avatar: '🍜' },
        { text: '渋谷で音楽イベントやってる！',    avatar: '🎵' },
        { text: '誰かボドゲやりたい人いる？🎲',   avatar: '🎲' },
        { text: 'この近くでおすすめのカフェある？', avatar: '☕' },
        { text: '今夜飲みいける人！🍻',            avatar: '🍻' },
      ];

      const initY  = HEADER_H + safefh - INPUT_H - BUBBLE_H;
      const initVy = -((initY - BURST_LINE_Y) / BUBBLE_LIFETIME);
      const now    = Date.now();

      const mockBubbles: Bubble[] = MOCK_DATA.map((item, i) => {
        const laneIdx = (i * 2) % LANE_COUNT;
        const x       = LANES[laneIdx] * safefw;
        const width   = 160;
        const vx      = (i % 2 === 0 ? 1 : -1) * 8;
        const id      = `mock-${i}`;

        // 物理エンジン（RAFループ）用にエントリを登録
        physicsRef.current.set(id, {
          x, y: initY, vx, vy: initVy,
          timeLeft: BUBBLE_LIFETIME, width,
          isOwn: false, lane: laneIdx, paused: false,
          createdAt: now, pausedElapsed: 0, pausedAt: null,
        });

        return {
          id,
          text:        item.text,
          avatar:      item.avatar,
          handle:      'user',
          isOwn:       false,
          lane:        laneIdx,
          left:        LANES[laneIdx] * 100,
          width,
          createdAt:   now,
          vx,
          vy:          initVy,
          timeLeft:    BUBBLE_LIFETIME,
          x,
          y:           initY,
          textColor:   '#FFFFFF',
          paused:      false,
          borderColor: RANDOM_BORDER_COLORS[i % RANDOM_BORDER_COLORS.length],
        };
      });

      setBubbles(mockBubbles);
    }, 500);

    return () => clearTimeout(timer);
  }, [loading, user]);

  // 自動生成（DEV_AUTO_SPAWN=true のときのみ動作）
  useEffect(() => {
    if (!DEV_AUTO_SPAWN) return;
    // DEV_AUTO_SPAWN = false のため実行されない
  }, []);

  // Realtime: 他ユーザーのバブルをリアルタイム受信
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('bubbles-realtime')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'bubbles',
          // filter は Supabase Realtime の制限でeq/neqはサーバーフィルタが要 Realtime RLSに依存する場合がある
          // ここでは受信後に自分のものを除外する
        },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = (payload.new as any);

          // 自分のバブルは無視
          if (row.user_id === user.id) return;

          // 期限切れチェック
          if (row.expires_at && new Date(row.expires_at) < new Date()) return;

          // 距離フィルター：自分の位置を取得して50m以内のみ表示
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: myProfile } = await (supabase as any)
            .from('profiles')
            .select('lat, lng')
            .eq('id', user.id)
            .single();

          // 距離フィルター（ネイティブ化後にBluetoothに置き換え予定）
          const ENABLE_GPS_FILTER = false;

          if (ENABLE_GPS_FILTER && row.lat && row.lng && myProfile?.lat && myProfile?.lng) {
            const dist = distanceMeters(myProfile.lat, myProfile.lng, row.lat, row.lng);
            if (dist > 50) return;
          }

          // 送信者のプロフィールを取得
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: prof } = await (supabase as any)
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', row.user_id)
            .single();

          // 既存の addBubble に流し込む（物理演算・表示ロジックはそのまま）
          const avatar = (prof as any)?.avatar_url ?? '👤';
          addBubbleRef.current(row.content, false, avatar);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();

    // AIスキャン（ブロック判定）
    try {
      const scanRes = await fetch('/api/scan-post', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });
      const { blocked, reason } = await scanRes.json();
      console.log('[bubbleScan] レスポンス:', { blocked, reason });
      if (blocked) {
        alert(`投稿できません：${reason}`);
        return;
      }
    } catch (e) {
      console.error('[bubbleScan] スキャンエラー:', e);
      // スキャンエラー時は投稿を通す
    }

    addBubble(text, true);
    setInput("");

    // Supabaseに保存（ログイン済みのみ）
    if (user) {
      // profilesから現在位置を取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileGps } = await (supabase as any)
        .from('profiles')
        .select('lat, lng')
        .eq('id', user.id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('bubbles') as any).insert({
        user_id:            user.id,
        content:            text,
        hashtags:           [],
        color:              null,
        session_id:         null,
        is_offline_created: false,
        expires_at:         new Date(Date.now() + 20 * 1000).toISOString(),
        lat:                profileGps?.lat ?? null,
        lng:                profileGps?.lng ?? null,
        radius:             50,
      });
      if (error) console.error('[bubble] insert error:', error);
    }
  }

  // 共通：Bubbleを一時停止（フォーカス演出も同時起動）
  function pauseBubble(id: string) {
    const state = physicsRef.current.get(id);
    if (state && !state.paused) {
      state.paused   = true;
      state.pausedAt = Date.now();
    }
    setFocusedBubbleId(id);
  }

  // 共通：Bubbleを再開（フォーカス演出も同時解除）
  function resumeBubble(id: string) {
    const state = physicsRef.current.get(id);
    if (state && state.paused) {
      if (state.pausedAt != null) {
        state.pausedElapsed += (Date.now() - state.pausedAt) / 1000;
        state.pausedAt = null;
      }
      state.paused = false;
    }
    setFocusedBubbleId(null);
  }

  // タップ → アクションメニュー表示
  function handleTap(clientX: number, clientY: number, b: Bubble) {
    if (b.isOwn) return;
    pauseBubble(b.id);
    setActionMenu({ bubbleId: b.id, bubble: b, clientX, clientY });
  }

  // メニュー外タップ → キャンセル
  function handleMenuClose() {
    if (actionMenu) resumeBubble(actionMenu.bubbleId);
    setActionMenu(null);
  }

  // リアクション選択（アクションメニューから）
  function handleReact(emoji: string) {
    if (!actionMenu) return;
    const { bubbleId, clientX, clientY } = actionMenu;

    const fieldRect = fieldRef.current?.getBoundingClientRect();
    const fieldTop  = fieldRect?.top  ?? 48;
    const fieldLeft = fieldRect?.left ?? 0;
    const fx = clientX - fieldLeft;
    const fy = clientY - fieldTop;

    // 絵文字がBubbleから飛び出すアニメーション
    const newEmojis: FloatingEmoji[] = Array.from({ length: 4 }, (_, i) => ({
      id:     emojiIdRef.current++,
      left:   0,
      emoji,
      size:   18 + Math.random() * 10,
      delay:  i * 60,
      fieldX: fx + (Math.random() - 0.5) * 20,
      fieldY: fy - HEADER_H - 10,  // fy はコンテナ座標 → フィールド座標に変換
    }));
    setFloatingEmojis(prev => [...prev, ...newEmojis]);
    const ids = new Set(newEmojis.map(fe => fe.id));
    setTimeout(() => setFloatingEmojis(prev => prev.filter(fe => !ids.has(fe.id))), 2000);

    // リアクションメッセージ表示
    let idx = Math.floor(Math.random() * REACTION_MESSAGES.length);
    if (idx === lastReactionMsgIdx.current && REACTION_MESSAGES.length > 1) {
      idx = (idx + 1) % REACTION_MESSAGES.length;
    }
    lastReactionMsgIdx.current = idx;
    const msg: BurstMessage = {
      id:   msgIdRef.current++,
      x:    fx,
      y:    fy - BUBBLE_H - 8,
      text: REACTION_MESSAGES[idx],
    };
    setBurstMessages(prev => [...prev, msg]);
    setTimeout(() => setBurstMessages(prev => prev.filter(m => m.id !== msg.id)), 900);

    resumeBubble(bubbleId);
    setActionMenu(null);
  }

  // 👍 ワンタップリアクション（メニューなし）
  function handleQuickLike(b: Bubble) {
    if (b.isOwn) return;
    const fieldRect = fieldRef.current?.getBoundingClientRect();
    const fieldLeft = fieldRect?.left ?? 0;
    const fieldTop  = fieldRect?.top  ?? 48;
    const state     = physicsRef.current.get(b.id);
    const fx = state ? state.x + state.width / 2 : 0;
    const fy = state ? state.y : 0;

    const newEmojis: FloatingEmoji[] = Array.from({ length: 3 }, (_, i) => ({
      id:     emojiIdRef.current++,
      left:   0,
      emoji:  reactionEmoji,
      size:   16 + Math.random() * 8,
      delay:  i * 60,
      fieldX: fx + (Math.random() - 0.5) * 24,
      fieldY: fy - HEADER_H - 10,  // fy はコンテナ座標 → フィールド座標に変換
    }));
    setFloatingEmojis(prev => [...prev, ...newEmojis]);
    const ids = new Set(newEmojis.map(fe => fe.id));
    setTimeout(() => setFloatingEmojis(prev => prev.filter(fe => !ids.has(fe.id))), 2000);

    // 0.5秒ゴールドグロー
    setLikedBubbleIds(prev => new Set([...prev, b.id]));
    setTimeout(() => setLikedBubbleIds(prev => { const n = new Set(prev); n.delete(b.id); return n; }), 500);
  }

  // DM ボタン → シートを開く（Bubble は paused のまま維持）
  function handleDMOpen() {
    if (!actionMenu) return;
    const { bubble } = actionMenu;
    setActionMenu(null); // メニューを閉じる（resumeBubble は呼ばない）
    setDmMessage("");
    setDmSheet({ bubbleId: bubble.id, userName: bubble.text.slice(0, 8), userIcon: bubble.avatar });
  }

  // DM シートを閉じる → Bubble 再開
  function handleDMClose() {
    if (dmSheet) resumeBubble(dmSheet.bubbleId);
    setDmSheet(null);
    setDmMessage("");
  }

  // DM 送信
  function handleDMSend() {
    if (!dmSheet || !dmMessage.trim()) return;
    console.log("[DM送信]", dmSheet.userName, ":", dmMessage.trim());
    if (dmSheet) resumeBubble(dmSheet.bubbleId);
    setDmSheet(null);
    setDmMessage("");
    setToastMsg(t('dmSent'));
    setTimeout(() => setToastMsg(null), 1500);
  }

  // ── レンダリング ──────────────────────────────────────────────────────

  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", height:"100dvh", overflow:"hidden", background:"#0d0d1a" }}>

      {/* ヘッダー */}
      <header ref={headerRef} style={{
        position:"sticky", top:0, flexShrink:0,
        width:"100%", height:"48px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"0 16px", zIndex:100,
        background:"transparent", pointerEvents:"none",
      }}>
        <SyncLogo width={120} />
        <span style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", display:"inline-block", boxShadow:"0 0 4px #4ade80" }} />
            <span style={{ color:"rgba(255,255,255,0.7)", fontSize:11 }}>{viewerCount.toLocaleString()} viewing</span>
          </span>
          <span style={{ color:"rgba(255,255,255,0.5)", fontSize:12 }}>{bubbles.length}/{MAX_BUBBLES}</span>
          <span style={{ color:"white", fontSize:14 }}>{t('title')} 🔴</span>
        </span>
      </header>

      {/* 大気背景 z-index:0 */}
      <div style={{ position:"absolute", inset:"48px 0 0 0", zIndex:0, overflow:"hidden", pointerEvents:"none" }}>
        <div style={{ position:"absolute", inset:0, background:TIME_BG[tod] }} />
        {fading && (
          <div style={{
            position:"absolute", inset:0,
            background: fading.gradient,
            opacity:    fading.opaque ? 1 : 0,
            transition: fading.opaque ? "none" : "opacity 120s ease",
            pointerEvents:"none",
          }} />
        )}
        {tod==="morning" && <>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 55% at 50% 90%,rgba(255,200,100,0.30) 0%,transparent 70%)" }} />
          {CLOUDS.map(c=><div key={c.id} style={{ position:"absolute", left:`${c.left}%`, top:`${c.top}%`, width:c.w, height:c.h, borderRadius:"50%", background:"rgba(255,250,240,0.26)", filter:"blur(18px)" }}/>)}
        </>}
        {tod==="day" && <>
          <div style={{ position:"absolute", inset:"0 0 60% 0", background:"linear-gradient(180deg,rgba(20,80,160,0.32) 0%,transparent 100%)" }} />
          {CLOUDS.map(c=><div key={c.id} style={{ position:"absolute", left:`${c.left}%`, top:`${c.top}%`, width:c.w, height:c.h, borderRadius:"50%", background:"rgba(255,255,255,0.20)", filter:"blur(22px)" }}/>)}
        </>}
        {tod==="evening" && <>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 90% 60% at 50% 85%,rgba(240,90,30,0.36) 0%,transparent 65%)" }} />
          <div style={{ position:"absolute", inset:"0 0 75% 0", background:"linear-gradient(180deg,rgba(60,10,120,0.32) 0%,transparent 100%)" }} />
        </>}
        {tod==="night" && <>
          {NEBULA.map(nb=><div key={nb.id} style={{ position:"absolute", left:`${nb.left}%`, top:`${nb.top}%`, width:nb.size, height:nb.size, borderRadius:"50%", background:nb.color, filter:"blur(38px)", transform:"translate(-50%,-50%)" }}/>)}
          <div style={{ position:"absolute", inset:"60% 0 0 0", background:"linear-gradient(transparent,rgba(1,1,8,0.55))" }} />
          {CLOUDS.map(c=><div key={c.id} style={{ position:"absolute", left:`${c.left}%`, top:`${c.top}%`, width:c.w, height:c.h, borderRadius:"50%", background:"rgba(20,10,60,0.18)", filter:"blur(28px)" }}/>)}
          {MICRO.map(s=><div key={s.id} style={{ position:"absolute", left:`${s.left}%`, top:`${s.top}%`, width:s.size, height:s.size, borderRadius:"50%", background:"#fff", ["--star-op" as string]:s.op, animation:`starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }}/>)}
          {NORMAL.map(s=><div key={s.id} style={{ position:"absolute", left:`${s.left}%`, top:`${s.top}%`, width:s.size, height:s.size, borderRadius:"50%", background:"#fff", boxShadow:`0 0 ${s.size*1.5}px rgba(255,255,255,${(s.op*0.6).toFixed(2)})`, ["--star-op" as string]:s.op, animation:`starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }}/>)}
          {BRIGHT.map(s=><div key={s.id} style={{ position:"absolute", left:`${s.left}%`, top:`${s.top}%`, width:s.size, height:s.size, borderRadius:"50%", background:"#fff", boxShadow:`0 0 ${s.size*2.5}px rgba(255,255,255,${(s.op*0.8).toFixed(2)}),0 0 ${s.size*5}px rgba(200,220,255,${(s.op*0.3).toFixed(2)})`, ["--star-op" as string]:s.op, animation:`starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }}/>)}
        </>}
      </div>

      {/* Bubbleフィールド z-index:10 */}
      <div
        ref={fieldRef}
        style={{
          position:  "relative",
          width:     "100%",
          flex:      1,
          minHeight: 0,
          zIndex:    10,
          overflow:  "hidden",
        }}
      >
        {bubbles.map(b => (
          <BubbleItem
            key={b.id}
            b={b}
            timeLeft={bubbleTimes.get(b.id) ?? b.timeLeft}
            isLiked={likedBubbleIds.has(b.id)}
            onTap={(cx, cy) => handleTap(cx, cy, b)}
            onQuickLike={() => handleQuickLike(b)}
            reactionEmoji={reactionEmoji}
            bubbleBorderColor={bubbleBorderColor}
            setRef={el => {
              if (el) {
                bubbleDivRefs.current.set(b.id, el);
                // マウント直後にフォーカス状態を即時反映
                el.style.transition = "filter 0.3s ease, opacity 0.3s ease";
                if (focusedBubbleId !== null && b.id !== focusedBubbleId) {
                  el.style.filter  = "blur(2px)";
                  el.style.opacity = "0.4";
                }
              } else {
                bubbleDivRefs.current.delete(b.id);
              }
            }}
          />
        ))}


        {/* 浮かぶリアクション絵文字 */}
        {floatingEmojis.map(fe => (
          <div
            key={fe.id}
            style={{
              position:      "absolute",
              ...(fe.fieldX !== undefined && fe.fieldY !== undefined
                ? { left: fe.fieldX, top: fe.fieldY }
                : { left: `${fe.left}%`, bottom: INPUT_H + 60 }),
              fontSize:      fe.size,
              lineHeight:    1,
              pointerEvents: "none",
              zIndex:        25,
              animation:     `emojiFloat 1.2s ${fe.delay}ms ease-out forwards`,
            }}
          >
            {fe.emoji}
          </div>
        ))}
      </div>

      {/* 破裂エフェクト — フィールド外に配置してoverflow:hiddenによるクリップを回避 z-index:110 */}
      {popBursts.map(pb => (
        <div key={pb.id} style={{ position:"absolute", left:pb.x, top:pb.y, pointerEvents:"none", zIndex:110 }}>
          {pb.particles.map(p => (
            <div
              key={p.id}
              style={{
                position:     "absolute",
                width:        p.size,
                height:       p.size,
                borderRadius: "50%",
                background:   "#FF1A1A",
                boxShadow:    `0 0 ${p.size * 2}px #FF1A1A`,
                top:          -p.size / 2,
                left:         -p.size / 2,
                ["--pdx" as string]: p.dx,
                ["--pdy" as string]: p.dy,
                animation:    "popParticle 600ms ease-out forwards",
              }}
            />
          ))}
        </div>
      ))}

      {/* リアクションメッセージ — フィールド外に配置 z-index:110 */}
      {burstMessages.map(m => (
        <div
          key={m.id}
          style={{
            position:      "absolute",
            left:          m.x,
            top:           m.y,
            fontSize:      14,
            fontWeight:    700,
            color:         "#FF1A1A",
            textShadow:    "0 1px 6px rgba(0,0,0,0.8)",
            whiteSpace:    "nowrap",
            userSelect:    "none",
            pointerEvents: "none",
            zIndex:        110,
            animation:     "burstMsgFade 0.8s ease-out forwards",
            transform:     "translate(-50%, 0)",
          }}
        >
          {m.text}
        </div>
      ))}

      {/* 入力欄 z-index:40 */}
      <div style={{
        position:             "absolute",
        bottom:               0,
        left:                 0,
        right:                0,
        zIndex:               40,
        height:               INPUT_H,
        background:           "rgba(13,13,26,0.82)",
        backdropFilter:       "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop:            "0.5px solid rgba(255,26,26,0.22)",
        padding:              "10px 14px",
        display:              "flex",
        alignItems:           "center",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, width:"100%" }}>
          <div style={{
            flex:1, display:"flex", alignItems:"center", gap:8,
            borderRadius:22, padding:"8px 12px 8px 14px",
            background: input.trim() ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.07)",
            border: `1px solid ${bubbleBorderColor === 'transparent' ? 'rgba(255,255,255,0.15)' : bubbleBorderColor}`,
            boxShadow: input.trim()
              ? `0 0 12px ${bubbleBorderColor === 'transparent' ? 'rgba(255,255,255,0.2)' : bubbleBorderColor}40`
              : "none",
            transition: "box-shadow 0.25s ease, background 0.25s ease",
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder={t('inputPlaceholder')}
              style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"#fff" }}
            />
            <span style={{
              fontSize:11, flexShrink:0, minWidth:20, textAlign:"right", fontVariantNumeric:"tabular-nums",
              color: input.length>=MAX_CHARS ? "#E63946" : input.length>=12 ? "#F4A261" : "rgba(255,255,255,0.22)",
            }}>
              {MAX_CHARS - input.length}
            </span>
            {input && (
              <button onClick={()=>setInput("")} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0, lineHeight:0 }}>
                <svg viewBox="0 0 16 16" fill="rgba(255,255,255,0.35)" width={11} height={11}>
                  <path d="M8 6.586L2.707 1.293 1.293 2.707 6.586 8l-5.293 5.293 1.414 1.414L8 9.414l5.293 5.293 1.414-1.414L9.414 8l5.293-5.293-1.414-1.414z"/>
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              width:40, height:40, borderRadius:"50%",
              border: '1.5px solid rgba(255,255,255,0.6)',
              cursor:         input.trim() ? "pointer" : "default",
              background:     'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.1)), linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)',
              backdropFilter: 'blur(8px)',
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.2s", flexShrink:0,
              boxShadow: '0 4px 15px rgba(150,100,255,0.4), inset 0 1px 0 rgba(255,255,255,0.6)',
              opacity: input.trim() ? 1 : 0.35,
              fontSize: 18,
            }}
          >
            🫧
          </button>
        </div>
      </div>

      {/* アクションメニュー z-index:29 */}
      {actionMenu && (
        <BubbleActionMenu
          menu={actionMenu}
          onReact={handleReact}
          onDm={handleDMOpen}
          onProfile={() => { const h = actionMenu.bubble.handle; handleMenuClose(); router.push(h === 'you' ? '/profile' : `/profile/${h}`); }}
          onClose={handleMenuClose}
        />
      )}

      {/* DM シート z-index:46 */}
      {dmSheet && (
        <DMSheet
          state={dmSheet}
          message={dmMessage}
          onMessageChange={setDmMessage}
          onSend={handleDMSend}
          onClose={handleDMClose}
        />
      )}

      {/* トースト */}
      {toastMsg && (
        <div style={{
          position:     "fixed",
          bottom:       96,
          left:         "50%",
          transform:    "translateX(-50%)",
          zIndex:       60,
          background:   "rgba(20,20,36,0.92)",
          border:       "0.5px solid rgba(255,26,26,0.32)",
          borderRadius: 24,
          padding:      "10px 20px",
          fontSize:     13,
          fontWeight:   600,
          color:        "#fff",
          whiteSpace:   "nowrap",
          boxShadow:    "0 4px 20px rgba(0,0,0,0.50)",
          backdropFilter:       "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          animation:    "menuPopIn 0.18s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}>
          {toastMsg}
        </div>
      )}

      {/* CSS */}
      <style>{`
        @keyframes bubblePop {
          0%   { scale: 1;   opacity: 1;   }
          35%  { scale: 1.3; opacity: 0.85; }
          100% { scale: 0;   opacity: 0;   }
        }

        @keyframes bubbleSpawn {
          0%   { transform: scale(0);   opacity: 0.6; }
          70%  { transform: scale(1.2); opacity: 1;   }
          100% { transform: scale(1.0); opacity: 1;   }
        }

        @keyframes pururu {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25%      { transform: translate(-2px, 1px) scale(1.02); }
          75%      { transform: translate(2px, -1px) scale(0.98); }
        }

        @keyframes popParticle {
          0%   { opacity: 1;   transform: translate(0, 0) scale(1.2); }
          60%  { opacity: 0.6; }
          100% { opacity: 0;   transform: translate(var(--pdx), var(--pdy)) scale(0); }
        }

        @keyframes burstMsgFade {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          20%  { opacity: 1; transform: translate(-50%, -60%) scale(1.05); }
          70%  { opacity: 1; transform: translate(-50%, -70%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -90%) scale(0.9); }
        }

        @keyframes emojiFloat {
          0%   { transform: translateY(0)      scale(1);   opacity: 1; }
          60%  { transform: translateY(-60px)  scale(1.2); opacity: 0.9; }
          100% { transform: translateY(-120px) scale(0.8); opacity: 0; }
        }

        @keyframes menuPopIn {
          from { opacity: 0; transform: scale(0.80) translateY(4px); }
          to   { opacity: 1; transform: scale(1.00) translateY(0);   }
        }

        @keyframes reactionPopIn {
          0%   { opacity: 0; transform: scale(0.6) translateY(8px); }
          70%  { opacity: 1; transform: scale(1.06) translateY(-2px); }
          100% { opacity: 1; transform: scale(1.0) translateY(0); }
        }

        @keyframes starTwinkle {
          0%, 100% { opacity: var(--star-op, 0.8); transform: scale(1); }
          40%      { opacity: 0.04; transform: scale(0.4); }
          70%      { opacity: var(--star-op, 0.8); transform: scale(1.1); }
        }

        @keyframes dmSlideUp {
          from { transform: translateX(-50%) translateY(100%); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }

        @keyframes dmSlideOut {
          from { transform: translateX(-50%) translateY(0);    opacity: 1; }
          to   { transform: translateX(-50%) translateY(100%); opacity: 0; }
        }

        textarea::placeholder { color: rgba(255,255,255,0.28); }
        input::placeholder { color: rgba(255,255,255,0.28); }
        button:active { transform: scale(0.93); }
      `}</style>

      {/* インスタライブ型リアクションエフェクト z-index:40 */}
      <ReactionFloatingEffect
        isActive={true}
        onBurst={(x, y) => triggerPopBurstRef.current?.(x, y)}
        triggerCount={postCount}
      />
    </div>
  );
}
