"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SyncLogo from "@/components/SyncLogo";
import { INFO_EVENTS, ORGANIZERS, HASHTAG_DATA, USER_TAGS, getTagEngagement, type HashtagPost } from "@/lib/mockData";
import { TagFilterBar } from "@/components/TagFilterBar";
import { RAINBOW } from "@/lib/rainbow";

// ── フィルター用ハッシュタグ ──────────────────────────────────────

const ALL_TAGS = [
  "#jprock", "#live", "#photo", "#night",
  "#design", "#minimal", "#coffee", "#engineer", "#words",
  "#baseball", "#soccer", "#athletics", "#band", "#challenge", "#youth",
];

// ── カウントダウン ────────────────────────────────────────────────

type CountdownStatus = "ended" | "today" | "urgent" | "soon" | "normal";

function getCountdownStatus(diffSec: number): CountdownStatus {
  if (diffSec <= 0)                return "ended";
  if (diffSec < 60 * 60 * 24)     return "today";
  if (diffSec < 60 * 60 * 24 * 3) return "urgent";
  if (diffSec < 60 * 60 * 24 * 7) return "soon";
  return "normal";
}

function EventCountdown({ isoDate }: { isoDate: string }) {
  const target    = useRef(new Date(isoDate).getTime());
  const [diff, setDiff] = useState(() => Math.floor((target.current - Date.now()) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setDiff(Math.floor((target.current - Date.now()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const status = getCountdownStatus(diff);

  if (status === "ended") {
    return (
      <div className="flex items-center gap-1.5 mt-2.5 mb-1">
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-md"
              style={{ background: "rgba(100,100,100,0.09)", color: "#999" }}>
          Ended
        </span>
      </div>
    );
  }

  const days  = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins  = Math.floor((diff % 3600)  / 60);
  const secs  = diff % 60;

  const boxBg    = status === "today"  ? "#E63946"
                 : status === "urgent" ? "#FF7C35"
                 : status === "soon"   ? "#FF7C35"
                 : "#1A1A1A";
  const labelCol = status === "today"  ? "#E63946"
                 : status === "urgent" ? "#FF7C35"
                 : "#888";

  if (status === "today") {
    return (
      <div className="flex items-center gap-2 mt-2.5 mb-1">
        <span className="text-[11px] font-black"
              style={{ color: "#E63946", animation: "outOfRangePulse 1s ease-in-out infinite" }}>
          🎉 Today
        </span>
      </div>
    );
  }

  const Unit = ({ val, label }: { val: number; label: string }) => (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center justify-center rounded-md"
           style={{
             width: 36, height: 34,
             background: boxBg,
             boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
           }}>
        <span className="text-white font-black tabular-nums" style={{ fontSize: 15, letterSpacing: "-0.02em" }}>
          {String(val).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[8px] font-bold" style={{ color: labelCol, letterSpacing: "0.04em" }}>
        {label}
      </span>
    </div>
  );

  const Sep = () => (
    <span className="font-black pb-3" style={{ color: boxBg, fontSize: 14, lineHeight: 1 }}>:</span>
  );

  return (
    <div className="mt-2.5 mb-1">
      <p className="text-[9px] font-bold mb-1.5" style={{ color: labelCol, letterSpacing: "0.08em" }}>
        Until event
      </p>
      <div className="flex items-end gap-1">
        <Unit val={days}  label={`${days}d left`} />
        <Sep />
        <Unit val={hours} label={`${hours}h left`} />
        <Sep />
        <Unit val={mins}  label={`${mins}m left`} />
        <Sep />
        <Unit val={secs}  label={`${secs}s`} />
      </div>
    </div>
  );
}

// ── イベントごとのグラデーション定義 ────────────────────────────
const EVENT_COLORS: Record<string, [string, string, string]> = {
  e1: ["#3D1A7A", "#1A0B40", "#0A0520"],
  e2: ["#0D3A6B", "#061A35", "#020A15"],
  e3: ["#0A3040", "#041520", "#020810"],
  e4: ["#5C2A00", "#2A1000", "#0F0500"],
  e5: ["#4A0D7A", "#200540", "#0A0220"],
};

// ── デフォルトフォロー・エンゲージメント ──────────────────────────

const DEFAULT_FOLLOWED_TAGS = ['jprock', 'live', 'music', 'photo', 'design', 'night', 'coffee'];

// ── 検索履歴ユーティリティ ──────────────────────────────────────

const HISTORY_KEY = "sync_search_history";
const HISTORY_MAX = 10;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(h: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

// ── メインコンポーネント ──────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const [followedOrgIds, setFollowedOrgIds] = useState<string[]>([]);
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [selectedTags,   setSelectedTags]   = useState<string[]>([]);
  const [isSearching,    setIsSearching]    = useState(false);
  const [query,          setQuery]          = useState("");
  const [history,        setHistory]        = useState<string[]>([]);
  const [selectedTag,    setSelectedTag]    = useState<string | null>(null);
  const [fromUrlTag,     setFromUrlTag]     = useState<string | null>(null);
  const [followedTags,   setFollowedTags]   = useState<Set<string>>(new Set());
  const inputRef              = useRef<HTMLInputElement>(null);
  const followedTagsReadyRef  = useRef(false);

  useEffect(() => {
    const refresh = () => {
      const stored = localStorage.getItem("followedOrgs");
      setFollowedOrgIds(stored ? JSON.parse(stored) : []);
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => { setHistory(loadHistory()); }, []);

  // フォロー済みタグ初期化 + エンゲージメントモックデータをシード
  useEffect(() => {
    // フォロー済みタグをlocalStorageから読み込む（なければデフォルト）
    const stored = localStorage.getItem('sync_followed_tags');
    if (stored) {
      try {
        const arr = JSON.parse(stored) as string[];
        setFollowedTags(new Set(arr.map(t => t.startsWith('#') ? t : `#${t}`)));
      } catch {
        setFollowedTags(new Set(DEFAULT_FOLLOWED_TAGS.map(t => `#${t}`)));
      }
    } else {
      setFollowedTags(new Set(DEFAULT_FOLLOWED_TAGS.map(t => `#${t}`)));
      localStorage.setItem('sync_followed_tags', JSON.stringify(DEFAULT_FOLLOWED_TAGS));
    }
    followedTagsReadyRef.current = true;
  }, []);

  // フォロー変更をlocalStorageに永続化（初期化後のみ）
  useEffect(() => {
    if (!followedTagsReadyRef.current) return;
    const arr = Array.from(followedTags).map(t => t.replace('#', ''));
    localStorage.setItem('sync_followed_tags', JSON.stringify(arr));
  }, [followedTags]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tag = params.get('tag');
    if (tag) {
      setSelectedTag(`#${tag}`);
      setFromUrlTag(`#${tag}`);
    }
  }, []);

  const followedEventIds = ORGANIZERS
    .filter((o) => followedOrgIds.includes(o.id))
    .flatMap((o) => o.eventIds);

  function handleFollowing() {
    setIsFollowing((prev) => !prev);
    setSelectedTags([]);
  }

  function activateSearch() {
    setIsSearching(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelSearch() {
    setIsSearching(false);
    setQuery("");
    setSelectedTag(null);
    inputRef.current?.blur();
  }

  function selectTag(tag: string) {
    const next = [tag, ...loadHistory().filter((t) => t !== tag)].slice(0, HISTORY_MAX);
    saveHistory(next);
    setHistory(next);
    setSelectedTag(tag);
  }

  function removeHistory(tag: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = history.filter((t) => t !== tag);
    setHistory(next);
    saveHistory(next);
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  const baseEvents = isFollowing
    ? INFO_EVENTS.filter((ev) => followedEventIds.includes(ev.id))
    : INFO_EVENTS;

  const filteredEvents = selectedTags.length === 0
    ? baseEvents
    : baseEvents.filter((ev) => selectedTags.some((t) => ev.tags.includes(t)));

  const q = query.replace(/^#/, "").trim();
  const suggestions = q === "" ? [] : Object.entries(HASHTAG_DATA)
    .filter(([tag]) => tag.replace("#", "").includes(q))
    .sort((a, b) => b[1].followers - a[1].followers)
    .slice(0, 10)
    .map(([tag]) => tag);

  if (selectedTag) {
    const isFromUrl = selectedTag === fromUrlTag;
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <TagResultView
          tag={selectedTag}
          followedTags={followedTags}
          setFollowedTags={setFollowedTags}
          onBack={() => router.back()}
          hideFollow={isFromUrl}
          onClose={cancelSearch}
          onTagSelect={selectTag}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">

      {/* ── ヘッダー */}
      <header className="flex-shrink-0 z-40 bg-bg/90 backdrop-blur-xl border-b border-border">

        {/* ロゴ行 — 検索中は縮小フェード */}
        <div style={{
          overflow: "hidden",
          maxHeight: isSearching ? 0 : 56,
          opacity: isSearching ? 0 : 1,
          transition: "max-height 0.22s cubic-bezier(0.32,0.72,0,1), opacity 0.18s",
        }}>
          <div className="flex items-center justify-between px-4 py-3">
            <SyncLogo width={120} />
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-dot-pulse" />
              <span className="text-xs text-muted">Discover</span>
            </div>
          </div>
        </div>

        {/* 常時表示の検索バー行 */}
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl cursor-text"
            style={{
              background: "rgb(var(--surface-rgb))",
              border: "1px solid rgb(var(--border-rgb))",
            }}
            onClick={!isSearching ? activateSearch : undefined}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-muted shrink-0">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path strokeLinecap="round" d="M13.5 13.5L17 17" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={activateSearch}
              placeholder="Search events..."
              className="flex-1 bg-transparent text-sm text-fore placeholder:text-muted outline-none"
              readOnly={!isSearching}
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted active:opacity-60 shrink-0">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M8 6.586L2.707 1.293 1.293 2.707 6.586 8l-5.293 5.293 1.414 1.414L8 9.414l5.293 5.293 1.414-1.414L9.414 8l5.293-5.293-1.414-1.414z" />
                </svg>
              </button>
            )}
          </div>

          {/* Cancel ボタン — 右からスライドイン */}
          <div style={{
            overflow: "hidden",
            maxWidth: isSearching ? 72 : 0,
            opacity: isSearching ? 1 : 0,
            transition: "max-width 0.22s cubic-bezier(0.32,0.72,0,1), opacity 0.18s",
            flexShrink: 0,
          }}>
            <button
              onClick={cancelSearch}
              className="text-sm font-medium whitespace-nowrap pl-1"
              style={{ color: "rgb(var(--muted-rgb))" }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* TagFilterBar — 検索中は非表示 */}
        {!isSearching && (
          <TagFilterBar
            allTags={ALL_TAGS}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
            variant="light"
            leadingItem={{
              label:   "Following",
              active:  isFollowing,
              onClick: handleFollowing,
            }}
          />
        )}
      </header>

      {/* ── コンテンツエリア */}
      <div className="flex-1 relative min-h-0">

        {/* イベントリスト */}
        <div className="absolute inset-0 overflow-y-auto">
          <EventListView
            key={selectedTags.join(",") + String(isFollowing)}
            items={filteredEvents}
            isFollowingTab={isFollowing}
            followedEventIds={followedEventIds}
          />
        </div>

        {/* 検索モード: オーバーレイ */}
        {isSearching && (
          <>
            {/* 暗いオーバーレイ */}
            <div
              className="absolute inset-0 z-10"
              style={{ background: "rgba(0,0,0,0.55)" }}
              onClick={cancelSearch}
            />

            {/* 結果パネル */}
            <div className="absolute top-0 inset-x-0 z-20 overflow-y-auto bg-bg" style={{ maxHeight: "100%" }}>
              {q !== "" && suggestions.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-muted text-sm">No tags matching &quot;{query}&quot;</p>
                </div>
              )}
              {q !== "" && suggestions.map((tag) => {
                const entry = HASHTAG_DATA[tag];
                return (
                  <button
                    key={tag}
                    onClick={() => selectTag(tag)}
                    className="flex items-center justify-between w-full px-5 py-4 border-b border-border/60 active:bg-surface/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "rgba(230,57,70,0.08)", border: "1.5px solid rgba(230,57,70,0.2)" }}
                      >
                        <span className="text-sm" style={{ color: "#E63946" }}>#</span>
                      </div>
                      <span className="text-sm font-bold text-fore">{tag}</span>
                    </div>
                    <span className="text-xs text-muted">{entry.followers.toLocaleString()} followers</span>
                  </button>
                );
              })}
              {q === "" && history.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <span className="text-xs font-bold text-muted">Search History</span>
                    <button onClick={clearHistory} className="text-xs text-muted active:opacity-60 transition-opacity">
                      Clear All
                    </button>
                  </div>
                  {history.map((tag) => (
                    <div key={tag} className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
                      <button
                        onClick={() => selectTag(tag)}
                        className="flex items-center gap-3 flex-1 min-w-0 active:opacity-60 transition-opacity text-left"
                      >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-muted shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 3v4l2.5 2.5M10 18a8 8 0 100-16 8 8 0 000 16z" />
                        </svg>
                        <span className="text-sm text-fore truncate">{tag}</span>
                      </button>
                      <button
                        onClick={(e) => removeHistory(tag, e)}
                        className="ml-3 w-6 h-6 flex items-center justify-center text-muted active:opacity-60 transition-opacity shrink-0"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                          <path d="M8 6.586L2.707 1.293 1.293 2.707 6.586 8l-5.293 5.293 1.414 1.414L8 9.414l5.293 5.293 1.414-1.414L9.414 8l5.293-5.293-1.414-1.414z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </>
              )}
              {q === "" && history.length === 0 && (
                <div className="py-20 text-center px-6">
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="text-sm text-muted">Search by hashtag</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── イベントリストビュー ─────────────────────────────────────────

type Event = typeof INFO_EVENTS[number];

function EventListView({
  items,
  isFollowingTab,
  followedEventIds = [],
}: {
  items: Event[];
  isFollowingTab?: boolean;
  followedEventIds?: string[];
}) {
  if (items.length === 0) {
    return isFollowingTab ? (
      <div className="py-16 text-center px-6">
        <p className="text-3xl mb-3">👥</p>
        <p className="text-fore font-bold text-sm mb-1">No followed organizers</p>
        <p className="text-muted/70 text-xs leading-relaxed">
          Follow an organizer from the event detail page<br />and events will appear here
        </p>
      </div>
    ) : (
      <div className="py-16 text-center">
        <p className="text-muted text-sm">No matching events</p>
        <p className="text-muted/50 text-xs mt-1">Try changing filters</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4 pb-32">
      {items.map((item) => {
        const [ic1, ic2, ic3] = EVENT_COLORS[item.id] ?? ["#2D1B69", "#1A0B40", "#07071A"];
        const isFollowed = followedEventIds.includes(item.id);
        return (
          <div
            key={item.id}
            className="rounded-2xl overflow-hidden border border-border"
            style={{ background: "rgb(var(--surface-rgb))" }}
          >
            {/* バナー */}
            <div
              className="relative h-36 flex items-end px-5 pb-4"
              style={{ background: `linear-gradient(155deg, ${ic1} 0%, ${ic2} 55%, ${ic3} 100%)` }}
            >
              {isFollowed && (
                <div
                  className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1"
                  style={{ background: "rgba(230,57,70,0.85)", backdropFilter: "blur(4px)" }}
                >
                  <span>👥</span><span>Following</span>
                </div>
              )}
              <span
                className="absolute inset-0 flex items-center justify-center text-[120px] select-none pointer-events-none"
                style={{ opacity: 0.1 }}
              >
                {item.emoji}
              </span>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl border border-white/20 shrink-0"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
              >
                {item.emoji}
              </div>
            </div>

            {/* カード本文 */}
            <div className="px-5 py-4">
              <h2 className="text-base font-black text-fore leading-tight mb-3">{item.title}</h2>
              <div className="flex flex-col gap-1.5 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📅</span>
                  <span className="text-xs text-muted font-medium">{item.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">📍</span>
                  <span className="text-xs text-muted font-medium">{item.place}</span>
                </div>
              </div>
              <EventCountdown isoDate={item.isoDate} />
              <div className="mb-2" />
              <div className="flex flex-wrap gap-1.5 mb-4">
                {item.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full border border-border text-muted">
                    {tag}
                  </span>
                ))}
              </div>
              <button
                className="w-full py-3 rounded-xl font-bold text-sm text-white"
                style={{
                  background: RAINBOW,
                  boxShadow: "0 4px 14px rgba(124,111,232,0.4)",
                }}
                onClick={() => { window.location.href = `/search/${item.id}`; }}
              >
                View →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── タグ結果ビュー ───────────────────────────────────────────────

function TagResultView({
  tag,
  followedTags,
  setFollowedTags,
  onBack,
  hideFollow,
  onClose,
  onTagSelect,
}: {
  tag: string;
  followedTags: Set<string>;
  setFollowedTags: React.Dispatch<React.SetStateAction<Set<string>>>;
  onBack:       () => void;
  hideFollow?:  boolean;
  onClose:      () => void;
  onTagSelect:  (tag: string) => void;
}) {
  const entry      = HASHTAG_DATA[tag];
  const isFollowed = followedTags.has(tag);
  const [commentPost, setCommentPost] = useState<HashtagPost | null>(null);

  const postTarget     = 3;
  const reactionTarget = 10;
  const [postCount,     setPostCount]     = useState(0);
  const [reactionCount, setReactionCount] = useState(0);
  const [toast,         setToast]         = useState('');

  const isEngaged     = postCount >= postTarget && reactionCount >= reactionTarget;
  const canComment    = (isFollowed || !!hideFollow) && isEngaged;

  // getTagEngagementの値を常に使う（タグが変わるたびにリセット）
  useEffect(() => {
    const tagName = tag.replace('#', '');
    const engagement = getTagEngagement(tagName);
    setPostCount(engagement.postCount);
    setReactionCount(engagement.reactionCount);
  }, [tag]);

  function handleReactionIncrement() {
    setReactionCount((c) => Math.min(c + 1, reactionTarget));
  }

  function handlePostIncrement() {
    setPostCount((c) => Math.min(c + 1, postTarget));
  }

  function showLockedToast() {
    if (isFollowed && postCount < postTarget) {
      setPostCount((c) => Math.min(c + 1, postTarget));
    }
    setToast('投稿3回またはリアクション10回で解放されます');
    setTimeout(() => setToast(''), 2500);
  }

  function toggleFollow() {
    setFollowedTags((prev) => {
      const next = new Set(prev);
      isFollowed ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  if (!entry) {
    return (
      <div className="absolute inset-0 z-[200] flex flex-col" style={{ background: 'var(--background)' }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
            style={{ background: "rgb(var(--surface-rgb))", border: "1px solid rgb(var(--border-rgb))" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-fore">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <span className="text-sm font-black text-fore flex-1 truncate">{tag}</span>
        </div>
        <div className="py-16 text-center">
          <p className="text-muted text-sm">No posts found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[200] flex flex-col" style={{ background: 'var(--background)' }}>

      {/* ── ヘッダー */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 active:scale-90 transition-transform"
          style={{ background: "rgb(var(--surface-rgb))", border: "1px solid rgb(var(--border-rgb))" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-fore">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <span className="text-sm font-black text-fore flex-1 truncate">{tag}</span>
      </div>

      {/* ── タグ情報バナー */}
      <div
        className="px-5 py-5 border-b border-border shrink-0"
        style={{ background: "linear-gradient(135deg, rgba(230,57,70,0.06) 0%, transparent 100%)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-black text-fore leading-tight mb-1">{tag}</p>
            <p className="text-xs text-muted">
              <span className="font-bold text-fore">{entry.followers.toLocaleString()}</span> people following
            </p>
          </div>
          {(isFollowed || hideFollow) ? (
            <div style={{ minWidth: 130 }}>
              <div style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>投稿</span>
                  <span style={{ fontSize: 10, fontWeight: 700, backgroundImage: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{postCount}/{postTarget}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: RAINBOW, width: `${Math.min(postCount / postTarget, 1) * 100}%`, transition: 'width 0.5s ease-out' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>リアクション</span>
                  <span style={{ fontSize: 10, fontWeight: 700, backgroundImage: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{reactionCount}/{reactionTarget}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: RAINBOW, width: `${Math.min(reactionCount / reactionTarget, 1) * 100}%`, transition: 'width 0.5s ease-out' }} />
                </div>
              </div>
              {isEngaged && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#4ade80', fontWeight: 700 }}>
                  ✓ コメント解放済み
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={toggleFollow}
              className="px-5 py-2 rounded-full text-sm font-bold shrink-0 active:scale-[0.97] transition-all"
              style={{ background: "#E63946", border: "1.5px solid #E63946", color: "#fff" }}
            >
              Follow
            </button>
          )}
        </div>
        {!isFollowed && !hideFollow && (
          <p className="mt-3 text-[11px] text-muted/70 leading-relaxed">
            Follow to connect with this community
          </p>
        )}
      </div>

      {/* ── 投稿リスト */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {entry.posts.map((post) => (
          <HashtagPostCard
            key={post.id}
            post={post}
            canLike={isFollowed}
            canComment={canComment}
            onLike={handleReactionIncrement}
            onComment={setCommentPost}
            onLockedComment={showLockedToast}
            onTagSelect={onTagSelect}
          />
        ))}
        <div className="h-16" />
      </div>

      {/* ── ロックトースト */}
      {toast && (
        <div style={{
          position: 'absolute',
          bottom: 80, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'rgba(20,20,42,0.96)',
          border: '1px solid rgba(255,26,26,0.35)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          padding: '10px 18px',
          borderRadius: 24,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}

      {/* ── コメントモーダル */}
      <HashtagReplyModal
        post={commentPost}
        open={!!commentPost}
        onClose={() => setCommentPost(null)}
        onPost={handlePostIncrement}
      />
    </div>
  );
}

// ── ハッシュタグ投稿カード ─────────────────────────────────────────

function HashtagPostCard({
  post,
  canLike,
  canComment,
  onLike,
  onComment,
  onLockedComment,
  onTagSelect,
}: {
  post: HashtagPost;
  canLike: boolean;
  canComment: boolean;
  onLike: () => void;
  onComment: (post: HashtagPost) => void;
  onLockedComment: () => void;
  onTagSelect: (tag: string) => void;
}) {
  const [liked, setLiked] = useState(false);
  const userTags = USER_TAGS[post.user.handle] ?? [];

  function handleLike() {
    if (!canLike) return;
    if (!liked) onLike();
    setLiked((prev) => !prev);
  }

  return (
    <div className="px-4 py-4 flex gap-3">
      {/* アバター */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 border border-border"
        style={{ background: "rgb(var(--surface-rgb))" }}
      >
        {post.user.avatar}
      </div>

      {/* 本文 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
          <span className="font-bold text-fore text-[13px]">{post.user.name}</span>
          <span className="text-muted text-[11px]">{post.user.handle}</span>
          <span className="text-muted/60 text-[11px]">· {post.time}</span>
        </div>
        <p className="text-fore text-[14px] leading-relaxed mb-2" style={{ whiteSpace: "pre-line" }}>
          {post.content}
        </p>

        {/* ハッシュタグ */}
        {userTags.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-3">
            {userTags.map((t) => (
              <button
                key={t}
                onClick={() => onTagSelect(t)}
                className="text-[12px] font-semibold active:opacity-60 transition-opacity"
                style={{ color: "#E63946" }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 transition-opacity"
            style={{ opacity: canLike ? 1 : 0.35, cursor: canLike ? "pointer" : "default" }}
          >
            <span className="text-base">{liked ? "❤️" : "🤍"}</span>
          </button>

          <button
            onClick={() => canComment ? onComment(post) : onLockedComment()}
            className="flex items-center gap-1.5 transition-opacity"
            style={{ opacity: canComment ? 1 : 0.35, cursor: "pointer" }}
          >
            <span className="text-base">💬</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ハッシュタグ投稿用コメントモーダル ────────────────────────────

const CURRENT_AVATAR = "🌟";

function spawnSheetBubbles(container: HTMLElement): void {
  if (typeof window === "undefined") return;
  const hour = new Date().getHours();
  const colors =
    hour >= 5  && hour < 10 ? ["rgba(255,180,100,0.9)", "rgba(255,150,80,0.8)",  "rgba(255,200,120,0.9)"] :
    hour >= 10 && hour < 17 ? ["rgba(100,180,255,0.9)", "rgba(80,200,255,0.8)",  "rgba(150,220,255,0.9)"] :
    hour >= 17 && hour < 20 ? ["rgba(255,100,100,0.9)", "rgba(255,120,80,0.8)",  "rgba(255,80,150,0.9)"]  :
                               ["rgba(150,80,255,0.9)",  "rgba(100,120,255,0.8)", "rgba(180,80,255,0.9)"];
  const w     = container.offsetWidth;
  const h     = container.offsetHeight;
  const count = 60 + Math.floor(Math.random() * 21);
  Array.from({ length: count }, (_, i) => {
    const el     = document.createElement("div");
    el.className = "tiny-bubble";
    const large  = i % 3 === 0;
    const size   = large ? 12 + Math.random() * 8 : 4 + Math.random() * 4;
    const x      = (i / count) * w + (Math.random() - 0.5) * (w / count);
    const delay  = Math.random() * 800;
    const dur    = 0.8 + Math.random() * 1.0;
    const tx     = (Math.random() - 0.5) * 160;
    const ty     = -(Math.random() * 50 + 40);
    const startY = h * 0.5 + Math.random() * h * 0.5;
    el.style.width                   = `${size}px`;
    el.style.height                  = `${size}px`;
    el.style.left                    = `${x}px`;
    el.style.top                     = `${startY}px`;
    el.style.background              = colors[i % colors.length];
    el.style.setProperty("--tx", `${tx}px`);
    el.style.setProperty("--ty", `${ty}px`);
    el.style.animationName           = "bubbleBlast";
    el.style.animationDuration       = `${dur}s`;
    el.style.animationDelay          = `${delay}ms`;
    el.style.animationFillMode       = "forwards";
    el.style.animationTimingFunction = "ease-out";
    container.appendChild(el);
    setTimeout(() => el.parentNode?.removeChild(el), 3000);
  });
}

function HashtagReplyModal({
  post,
  open,
  onClose,
  onPost,
}: {
  post: HashtagPost | null;
  open: boolean;
  onClose: () => void;
  onPost: () => void;
}) {
  const [text, setText] = useState("");
  const textaRef    = useRef<HTMLTextAreaElement>(null);
  const modalRef    = useRef<HTMLDivElement>(null);
  const lastPostRef = useRef<HashtagPost | null>(null);
  if (post) lastPostRef.current = post;
  const displayPost = post ?? lastPostRef.current;

  useEffect(() => {
    if (open) {
      if (modalRef.current) spawnSheetBubbles(modalRef.current);
      setText("");
      setTimeout(() => textaRef.current?.focus(), 80);
    }
  }, [open, post?.id]);

  return (
    <div
      ref={modalRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 70,
        background: "rgb(var(--bg-rgb, 13 13 26))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: open ? "transform 0.25s ease-out" : "transform 0.28s ease-in",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {/* ヘッダー */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px 12px",
        borderBottom: "1px solid rgb(var(--border-rgb, 50 50 80))",
      }}>
        <button
          onClick={onClose}
          style={{
            fontSize: 15, fontWeight: 500,
            color: "rgb(var(--fore-rgb, 255 255 255))",
            background: "none", border: "none", cursor: "pointer",
            padding: "2px 4px",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => { if (text.trim()) { setText(""); onPost(); onClose(); } }}
          style={{
            paddingLeft: 20, paddingRight: 20, paddingTop: 7, paddingBottom: 7,
            borderRadius: 9999,
            fontSize: 14, fontWeight: 700,
            background: text.trim() ? "#E63946" : "rgba(230,57,70,0.3)",
            color: "#fff",
            border: "none",
            cursor: text.trim() ? "pointer" : "default",
            transition: "background 0.15s",
          }}
        >
          Post
        </button>
      </div>

      {/* ボディ */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {displayPost && (
          <>
            {/* 元投稿 */}
            <div style={{ display: "flex", gap: 12, padding: "16px 16px 0" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                  background: "rgb(var(--surface-rgb, 20 20 42))",
                  border: "1px solid rgb(var(--border-rgb, 50 50 80))",
                }}>
                  {displayPost.user.avatar}
                </div>
                <div style={{
                  flex: 1, width: 2,
                  background: "rgb(var(--border-rgb, 50 50 80))",
                  borderRadius: 1, minHeight: 28, marginTop: 6,
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "rgb(var(--fore-rgb, 255 255 255))" }}>
                    {displayPost.user.name}
                  </span>
                  <span style={{ fontSize: 12, color: "rgb(var(--muted-rgb, 136 136 170))" }}>
                    {displayPost.user.handle}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(136, 136, 170, 0.7)", marginLeft: "auto" }}>
                    {displayPost.time}
                  </span>
                </div>
                <p style={{
                  fontSize: 15,
                  color: "rgb(var(--fore-rgb, 255 255 255))",
                  lineHeight: 1.65,
                  whiteSpace: "pre-line",
                  marginBottom: 8,
                }}>
                  {displayPost.content}
                </p>
                {(USER_TAGS[displayPost.user.handle] ?? []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
                    {(USER_TAGS[displayPost.user.handle] ?? []).map((t) => (
                      <span key={t} style={{ fontSize: 12, fontWeight: 600, color: "#E63946" }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* リプライ入力 */}
            <div style={{ display: "flex", gap: 12, padding: "0 16px 16px" }}>
              <div style={{ width: 40, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ height: 28 }} />
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                  background: "rgb(var(--surface-rgb, 20 20 42))",
                  border: "1px solid rgb(var(--border-rgb, 50 50 80))",
                }}>
                  {CURRENT_AVATAR}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13,
                  color: "rgb(var(--muted-rgb, 136 136 170))",
                  marginBottom: 10, lineHeight: 1.4, paddingTop: 4,
                }}>
                  Replying to{" "}
                  <span style={{ color: "#E63946", fontWeight: 600 }}>
                    {displayPost.user.handle}
                  </span>
                </p>
                <textarea
                  ref={textaRef}
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Post your reply..."
                  style={{
                    width: "100%",
                    resize: "none",
                    outline: "none",
                    background: "transparent",
                    color: "rgb(var(--fore-rgb, 255 255 255))",
                    fontSize: 17,
                    lineHeight: 1.65,
                    caretColor: "#E63946",
                    border: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
