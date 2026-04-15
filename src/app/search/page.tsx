"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from 'next-intl';
import { useRouter } from "next/navigation";
import SyncLogo from "@/components/SyncLogo";
import { INFO_EVENTS, ORGANIZERS, type Post } from "@/lib/mockData";
import PostCard from "@/components/PostCard";
import HashtagFilterBar from "@/components/HashtagFilterBar";
import BottomSheet from "@/components/BottomSheet";
import { RAINBOW } from "@/lib/rainbow";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import TagResultView from "./TagResultView";


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

// ── 検索履歴ユーティリティ ──────────────────────────────────────

type HistoryItem = { type: 'tag' | 'user'; value: string; label: string };

const HISTORY_KEY = "sync_search_history";
const HISTORY_MAX = 10;

function loadHistory(): HistoryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    // 旧フォーマット（string[]）の場合は捨てて空配列を返す
    if (!Array.isArray(raw) || (raw.length > 0 && typeof raw[0] === 'string')) return [];
    return raw as HistoryItem[];
  } catch { return []; }
}
function saveHistory(h: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}
function addToHistory(item: HistoryItem) {
  const prev = loadHistory().filter(h => !(h.type === item.type && h.value === item.value));
  saveHistory([item, ...prev].slice(0, HISTORY_MAX));
}

// ── 検索結果型 ────────────────────────────────────────────────────

type TagSuggestion = { tag: string; count: number; isNew: boolean }

type UserResult = {
  id:           string;
  username:     string;
  display_name: string;
  avatar_url:   string | null;
};

// ── メインコンポーネント ──────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const [followedOrgIds, setFollowedOrgIds] = useState<string[]>([]);
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [selectedTags,   setSelectedTags]   = useState<string[]>([]);
  const [isSearching,    setIsSearching]    = useState(false);
  const [query,          setQuery]          = useState("");
  const [history,        setHistory]        = useState<HistoryItem[]>([]);
  const [selectedTag,    setSelectedTag]    = useState<string | null>(null);
  const [fromUrlTag,     setFromUrlTag]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, followedHashtags, followHashtag } = useAuth();
  // サジェスト: DB から取得したタグ候補
  const [suggestions,   setSuggestions]   = useState<TagSuggestion[]>([]);
  // 検索タブ + 全文検索結果
  const [searchTab,     setSearchTab]     = useState<'hashtag' | 'user'>('hashtag');
  const [userResults,   setUserResults]   = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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
  }

  function cancelSearch() {
    setIsSearching(false);
    setQuery("");
    setSelectedTag(null);
  }

  function selectTag(tag: string) {
    addToHistory({ type: 'tag', value: tag, label: tag });
    setHistory(loadHistory());
    setIsSearching(false);
    setQuery('');
    setSelectedTag(tag);
  }

  function selectUser(u: UserResult) {
    addToHistory({ type: 'user', value: u.username, label: u.display_name });
    setHistory(loadHistory());
    router.push(`/profile/${u.username}`);
  }

  function selectHistoryItem(item: HistoryItem) {
    if (item.type === 'tag') {
      setIsSearching(false);
      setQuery('');
      setSelectedTag(item.value);
    } else {
      router.push(`/profile/${item.value}`);
    }
  }

  function removeHistory(item: HistoryItem, e: React.MouseEvent) {
    e.stopPropagation();
    const next = history.filter(h => !(h.type === item.type && h.value === item.value));
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

  // 統合検索: q が変わるたびに 300ms debounce
  useEffect(() => {
    if (q === '') {
      setSuggestions([]);
      setUserResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      // ① ハッシュタグサジェスト
      // followsテーブルからマッチするタグを全取得
      const { data: followData } = await supabase
        .from('follows')
        .select('tag')
        .eq('type', 'hashtag')
        .ilike('tag', `%${q}%`)
        .not('tag', 'is', null)
        .limit(50)

      // タグごとにフォロワー数を集計
      const tagMap = new Map<string, number>()
      for (const row of (followData ?? []) as { tag: string }[]) {
        const t = row.tag
        tagMap.set(t, (tagMap.get(t) ?? 0) + 1)
      }

      // 結果を配列に変換
      const result: TagSuggestion[] = [...tagMap.entries()]
        .map(([tag, count]) => ({ tag, count, isNew: false }))
        .sort((a, b) => b.count - a.count)

      // 入力値と完全一致するタグがなければ先頭にオーナー候補を追加
      const inputTag = q.startsWith('#') ? q : `#${q}`
      const exactMatch = result.some(r => r.tag.toLowerCase() === inputTag.toLowerCase())
      if (!exactMatch) {
        result.unshift({ tag: inputTag, count: 0, isNew: true })
      }

      setSuggestions(result.slice(0, 15));

      // ② ユーザー検索
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      setUserResults((usersData ?? []) as UserResult[]);

      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [q]);

  if (selectedTag) {
    const isFromUrl = selectedTag === fromUrlTag;
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <TagResultView
          tag={selectedTag}
          onBack={() => {
            if (isFromUrl) {
              router.back();
            } else {
              setSelectedTag(null);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">

      {/* ── ヘッダー（通常時） */}
      <header className="flex-shrink-0 z-40 bg-bg/90 backdrop-blur-xl border-b border-border">
        {/* ロゴ行 */}
        <div className="flex items-center justify-between px-4 py-3">
          <SyncLogo width={120} />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-dot-pulse" />
            <span className="text-xs text-muted">Discover</span>
          </div>
        </div>

        {/* 検索バー（タップで全画面オーバーレイを開く） */}
        <div className="flex items-center gap-2 px-4 pb-2.5">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl cursor-text"
            style={{
              background: "rgb(var(--surface-rgb))",
              border: "1px solid rgb(var(--border-rgb))",
            }}
            onClick={activateSearch}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-muted shrink-0">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path strokeLinecap="round" d="M13.5 13.5L17 17" />
            </svg>
            <span className="flex-1 text-sm text-muted">Search...</span>
          </div>
        </div>

        {/* ハッシュタグフィルターバー */}
        {followedHashtags.length > 0 ? (
          <HashtagFilterBar
            tags={followedHashtags}
            selected={selectedTags}
            onChange={setSelectedTags}
          />
        ) : (
          <div
            className="px-4 py-2.5 flex items-center"
            style={{ borderBottom: '1px solid var(--surface-2)' }}
          >
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>
              まだフォロー中のタグがありません
            </p>
          </div>
        )}
      </header>

      {/* ── コンテンツエリア */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-y-auto">
          <EventListView
            key={selectedTags.join(",") + String(isFollowing)}
            items={filteredEvents}
            isFollowingTab={isFollowing}
            followedEventIds={followedEventIds}
          />
        </div>
      </div>

      {/* ── フルスクリーン検索オーバーレイ（状態②③） */}
      {isSearching && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '375px',
            zIndex: 50,
            background: 'var(--background)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 上部: 検索バー + キャンセル */}
          <div
            className="flex-shrink-0 flex items-center gap-2 px-4"
            style={{
              paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)',
              paddingBottom: 10,
              borderBottom: '1px solid var(--surface-2)',
            }}
          >
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: 'rgb(var(--surface-rgb))',
                border: '1px solid rgb(var(--border-rgb))',
              }}
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
                placeholder="Search..."
                className="flex-1 bg-transparent text-sm text-fore placeholder:text-muted outline-none"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted active:opacity-60 shrink-0">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M8 6.586L2.707 1.293 1.293 2.707 6.586 8l-5.293 5.293 1.414 1.414L8 9.414l5.293 5.293 1.414-1.414L9.414 8l5.293-5.293-1.414-1.414z" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={cancelSearch}
              className="text-sm font-medium shrink-0"
              style={{ color: 'var(--muted)' }}
            >
              キャンセル
            </button>
          </div>

          {/* 検索タブ（2タブ） */}
          <div
            className="flex-shrink-0 flex gap-2 px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--surface-2)' }}
          >
            {(['hashtag', 'user'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSearchTab(tab)}
                className="shrink-0 text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all active:scale-95"
                style={searchTab === tab
                  ? { background: RAINBOW, color: '#fff', border: 'none' }
                  : { background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--surface-2)' }
                }
              >
                {tab === 'hashtag' ? '# タグ' : 'ユーザー'}
              </button>
            ))}
          </div>

          {/* スクロール可能なコンテンツ */}
          <div className="flex-1 overflow-y-auto">

            {/* 状態②: 入力なし → 履歴 */}
            {q === '' && (
              <>
                {history.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between px-5 pt-4 pb-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>最近の検索</span>
                      <button onClick={clearHistory} className="text-xs active:opacity-60 transition-opacity" style={{ color: 'var(--muted)' }}>すべて削除</button>
                    </div>
                    {history.map(item => (
                      <div
                        key={`${item.type}-${item.value}`}
                        className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderBottom: '1px solid var(--surface-2)' }}
                      >
                        <button
                          onClick={() => selectHistoryItem(item)}
                          className="flex items-center gap-3 flex-1 min-w-0 active:opacity-60 transition-opacity text-left"
                        >
                          {item.type === 'tag' ? (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(230,57,70,0.08)', border: '1.5px solid rgba(230,57,70,0.2)' }}>
                              <span className="text-xs font-bold" style={{ color: '#E63946' }}>#</span>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style={{ background: 'var(--surface-2)' }}>
                              👤
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                              {item.type === 'tag' ? item.value : item.label}
                            </p>
                            {item.type === 'user' && (
                              <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>@{item.value}</p>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={(e) => removeHistory(item, e)}
                          className="ml-3 w-6 h-6 flex items-center justify-center active:opacity-60 transition-opacity shrink-0"
                          style={{ color: 'var(--muted)' }}
                        >
                          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                            <path d="M8 6.586L2.707 1.293 1.293 2.707 6.586 8l-5.293 5.293 1.414 1.414L8 9.414l5.293 5.293 1.414-1.414L9.414 8l5.293-5.293-1.414-1.414z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="py-20 text-center px-6">
                    <p className="text-3xl mb-3">🔍</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>
                      {searchTab === 'hashtag' ? 'タグを検索' : 'ユーザーを検索'}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* 状態③: 入力あり → 検索結果 */}
            {q !== '' && (
              <>
                {searchLoading && (
                  <div className="py-10 text-center">
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>検索中…</p>
                  </div>
                )}

                {/* ハッシュタグタブ */}
                {!searchLoading && searchTab === 'hashtag' && suggestions.map(({ tag, count, isNew }) => (
                  <button
                    key={tag}
                    onClick={() => selectTag(tag)}
                    className="flex items-center gap-3 w-full px-5 py-4 active:opacity-70 transition-opacity"
                    style={{ borderBottom: '1px solid var(--surface-2)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: isNew ? 'rgba(245,158,11,0.1)' : 'rgba(230,57,70,0.08)',
                        border: isNew ? '1.5px solid rgba(245,158,11,0.3)' : '1.5px solid rgba(230,57,70,0.2)'
                      }}
                    >
                      <span className="text-sm font-bold" style={{ color: isNew ? '#f59e0b' : '#E63946' }}>
                        {isNew ? '👑' : '#'}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{tag}</p>
                      {isNew ? (
                        <p className="text-xs" style={{ color: '#f59e0b' }}>オーナー募集中 · 最初のフォロワーになれます</p>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{count} Following</p>
                      )}
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                      className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}

                {/* ユーザータブ */}
                {!searchLoading && searchTab === 'user' && (
                  <>
                    {userResults.length === 0 ? (
                      <div className="py-16 text-center px-6">
                        <p className="text-sm" style={{ color: 'var(--muted)' }}>「{q}」に一致するユーザーが見つかりません</p>
                      </div>
                    ) : (
                      userResults.map(u => (
                        <button
                          key={u.id}
                          onClick={() => selectUser(u)}
                          className="flex items-center gap-3 w-full px-5 py-3.5 active:opacity-70 transition-opacity"
                          style={{ borderBottom: '1px solid var(--surface-2)' }}
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--surface-2)' }}>
                            {u.avatar_url ?? '👤'}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>{u.display_name}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>@{u.username}</p>
                          </div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      ))
                    )}
                  </>
                )}
              </>
            )}

          </div>
        </div>
      )}
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


