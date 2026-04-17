"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from 'next-intl';
import { useRouter } from "next/navigation";
import SyncLogo from "@/components/SyncLogo";
import { RAINBOW } from "@/lib/rainbow";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { GENRES, GENRE_HASHTAGS } from "@/lib/genreHashtags";
import TagResultView from "./TagResultView";

// ── 型定義 ────────────────────────────────────────────────────────

type TagCount = { tag: string; count: number };

type HistoryItem = { type: 'tag' | 'user'; value: string; label: string };
type UserResult  = { id: string; username: string; display_name: string; avatar_url: string | null };
type TagSuggestion = { tag: string; count: number; isNew: boolean };

// ── 検索履歴ユーティリティ ────────────────────────────────────────

const HISTORY_KEY = "sync_search_history";
const HISTORY_MAX = 10;

function loadHistory(): HistoryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
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

// ── 全タグリスト（GENRE_HASHTAGS の全値をフラット化、重複除去） ──

const ALL_TAGS = [...new Set(Object.values(GENRE_HASHTAGS).flat())];

// ── メインコンポーネント ──────────────────────────────────────────

export default function SearchPage() {
  const t = useTranslations('search');
  const router = useRouter();
  const { followedHashtags } = useAuth();

  // ジャンルタブ
  const [activeGenre, setActiveGenre] = useState<string | null>(null); // null = すべて

  // フォロー数マップ: tag → count
  const [tagCounts, setTagCounts] = useState<Map<string, number>>(new Map());
  const [countsLoading, setCountsLoading] = useState(true);

  // もっと見る
  const [expanded, setExpanded] = useState(false);

  // タグ詳細表示
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [fromUrlTag,  setFromUrlTag]  = useState<string | null>(null);

  // フルスクリーン検索
  const [isSearching,   setIsSearching]   = useState(false);
  const [query,         setQuery]         = useState("");
  const [searchTab,     setSearchTab]     = useState<'hashtag' | 'user'>('hashtag');
  const [suggestions,   setSuggestions]   = useState<TagSuggestion[]>([]);
  const [userResults,   setUserResults]   = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [history,       setHistory]       = useState<HistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL パラメータ処理
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tag = params.get('tag');
    if (tag) {
      setSelectedTag(`#${tag}`);
      setFromUrlTag(`#${tag}`);
    }
    setHistory(loadHistory());
  }, []);

  // フォロー数を RPC で一括集計（DB側 GROUP BY → タグ数分の行だけ転送）
  useEffect(() => {
    (async () => {
      setCountsLoading(true);
      const { data, error } = await supabase.rpc('get_hashtag_follower_counts');

      if (error) {
        console.error('[Search] follower counts error:', error);
      }

      const map = new Map<string, number>();
      for (const row of (data ?? []) as { tag: string; follower_count: number }[]) {
        if (row.tag) map.set(row.tag, Number(row.follower_count));
      }
      setTagCounts(map);
      setCountsLoading(false);
    })();
  }, []);

  // ジャンル変更時に「もっと見る」をリセット
  useEffect(() => { setExpanded(false); }, [activeGenre]);

  // 表示するタグリスト（ジャンルに応じてフィルタ → フォロー数降順）
  const genreTags: TagCount[] = (() => {
    const sourceTags = activeGenre === null
      ? ALL_TAGS
      : (GENRE_HASHTAGS[activeGenre] ?? []);

    return sourceTags
      .map(tag => ({ tag, count: tagCounts.get(tag) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  })();

  const DEFAULT_SHOW = 5;
  const visibleTags = expanded ? genreTags : genreTags.slice(0, DEFAULT_SHOW);
  const hasMore = genreTags.length > DEFAULT_SHOW;

  // 統合検索 debounce
  const q = query.replace(/^#/, "").trim();
  useEffect(() => {
    if (q === '') {
      setSuggestions([]);
      setUserResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const { data: followData } = await supabase
        .from('follows')
        .select('tag')
        .eq('type', 'hashtag')
        .ilike('tag', `%${q}%`)
        .not('tag', 'is', null)
        .limit(50);

      const tagMap = new Map<string, number>();
      for (const row of (followData ?? []) as { tag: string }[]) {
        tagMap.set(row.tag, (tagMap.get(row.tag) ?? 0) + 1);
      }
      const result: TagSuggestion[] = [...tagMap.entries()]
        .map(([tag, count]) => ({ tag, count, isNew: false }))
        .sort((a, b) => b.count - a.count);

      const inputTag = q.startsWith('#') ? q : `#${q}`;
      if (!result.some(r => r.tag.toLowerCase() === inputTag.toLowerCase())) {
        result.unshift({ tag: inputTag, count: 0, isNew: true });
      }
      setSuggestions(result.slice(0, 15));

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
    if (item.type === 'tag') { setIsSearching(false); setQuery(''); setSelectedTag(item.value); }
    else router.push(`/profile/${item.value}`);
  }

  function removeHistory(item: HistoryItem, e: React.MouseEvent) {
    e.stopPropagation();
    const next = history.filter(h => !(h.type === item.type && h.value === item.value));
    setHistory(next);
    saveHistory(next);
  }

  function clearHistory() { setHistory([]); saveHistory([]); }

  // タグ詳細画面
  if (selectedTag) {
    const isFromUrl = selectedTag === fromUrlTag;
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <TagResultView
          tag={selectedTag}
          onBack={() => { if (isFromUrl) router.back(); else setSelectedTag(null); }}
        />
      </div>
    );
  }

  // ジャンルタブ定義
  const tabs = [
    { key: null,  label: t('tabAll') },
    ...GENRES.map(g => ({ key: g.label, label: t(`genres.${g.label}`) })),
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">

      {/* ── ヘッダー */}
      <header
        className="flex-shrink-0 z-40"
        style={{ background: 'var(--background)', borderBottom: '1px solid var(--surface-2)' }}
      >
        {/* ロゴ行 */}
        <div className="flex items-center justify-between px-4 py-3">
          <SyncLogo width={120} />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-dot-pulse" />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Discover</span>
          </div>
        </div>

        {/* 検索バー */}
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-text"
            style={{ background: 'rgb(var(--surface-rgb))', border: '1px solid rgb(var(--border-rgb))' }}
            onClick={() => setIsSearching(true)}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }}>
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path strokeLinecap="round" d="M13.5 13.5L17 17" />
            </svg>
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{t('searchPlaceholder')}</span>
          </div>
        </div>

        {/* ジャンルタブ横スクロール */}
        <div
          className="flex gap-0 px-4"
          style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
        >
          {tabs.map(({ key, label }) => {
            const active = activeGenre === key;
            return (
              <button
                key={key ?? '__all__'}
                onClick={() => setActiveGenre(key)}
                className="shrink-0 pb-2.5 pt-1 px-3 text-sm font-semibold transition-colors relative"
                style={{ color: active ? 'var(--foreground)' : 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                {label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: RAINBOW }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {countsLoading ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>読み込み中...</p>
          </div>
        ) : genreTags.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('noTags')}</p>
          </div>
        ) : (
          <>
            {visibleTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => selectTag(tag)}
                className="flex items-center justify-between w-full active:opacity-70 transition-opacity"
                style={{ padding: '14px 16px', borderBottom: '1px solid var(--surface-2)', background: 'transparent', border: 'none', borderBottomColor: 'var(--surface-2)', borderBottomWidth: 1, borderBottomStyle: 'solid', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>{tag}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {count.toLocaleString()}{t('followerSuffix')}
                </span>
              </button>
            ))}

            {hasMore && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full py-4 text-sm font-semibold active:opacity-70 transition-opacity"
                style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--surface-2)' }}
              >
                {expanded ? t('showLess') : t('showMore')}
              </button>
            )}
          </>
        )}

        {/* フォロー中タグのセクション（未フォローなら非表示） */}
        {followedHashtags.length > 0 && (
          <div className="mt-6 px-4 pb-32">
            <p className="text-xs font-bold mb-3" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
              フォロー中
            </p>
            <div className="flex flex-wrap gap-2">
              {followedHashtags.map(tag => (
                <button
                  key={tag}
                  onClick={() => selectTag(tag)}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold active:opacity-70 transition-opacity"
                  style={{ background: 'var(--surface-2)', color: 'var(--foreground)', border: 'none', cursor: 'pointer' }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── フルスクリーン検索オーバーレイ */}
      {isSearching && (
        <div
          style={{
            position: 'fixed', top: 0, bottom: 0,
            left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '375px',
            zIndex: 50, background: 'var(--background)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* 検索バー + キャンセル */}
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
              style={{ background: 'rgb(var(--surface-rgb))', border: '1px solid rgb(var(--border-rgb))' }}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }}>
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path strokeLinecap="round" d="M13.5 13.5L17 17" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--foreground)' }}
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery("")} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M8 6.586L2.707 1.293 1.293 2.707 6.586 8l-5.293 5.293 1.414 1.414L8 9.414l5.293 5.293 1.414-1.414L9.414 8l5.293-5.293-1.414-1.414z" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={() => { setIsSearching(false); setQuery(""); }}
              className="text-sm font-medium shrink-0"
              style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              キャンセル
            </button>
          </div>

          {/* タブ */}
          <div className="flex-shrink-0 flex gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--surface-2)' }}>
            {(['hashtag', 'user'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSearchTab(tab)}
                className="shrink-0 text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all active:scale-95"
                style={searchTab === tab
                  ? { background: RAINBOW, color: '#fff', border: 'none', cursor: 'pointer' }
                  : { background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--surface-2)', cursor: 'pointer' }
                }
              >
                {tab === 'hashtag' ? '# タグ' : 'ユーザー'}
              </button>
            ))}
          </div>

          {/* スクロールコンテンツ */}
          <div className="flex-1 overflow-y-auto">
            {/* 入力なし → 履歴 */}
            {q === '' && (
              <>
                {history.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between px-5 pt-4 pb-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>最近の検索</span>
                      <button onClick={clearHistory} className="text-xs" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>すべて削除</button>
                    </div>
                    {history.map(item => (
                      <div
                        key={`${item.type}-${item.value}`}
                        className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderBottom: '1px solid var(--surface-2)' }}
                      >
                        <button
                          onClick={() => selectHistoryItem(item)}
                          className="flex items-center gap-3 flex-1 min-w-0 active:opacity-60 text-left"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {item.type === 'tag' ? (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(230,57,70,0.08)', border: '1.5px solid rgba(230,57,70,0.2)' }}>
                              <span className="text-xs font-bold" style={{ color: '#E63946' }}>#</span>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style={{ background: 'var(--surface-2)' }}>👤</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                              {item.type === 'tag' ? item.value : item.label}
                            </p>
                            {item.type === 'user' && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>@{item.value}</p>}
                          </div>
                        </button>
                        <button onClick={e => removeHistory(item, e)} className="ml-3 w-6 h-6 flex items-center justify-center shrink-0" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
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
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>{searchTab === 'hashtag' ? 'タグを検索' : 'ユーザーを検索'}</p>
                  </div>
                )}
              </>
            )}

            {/* 入力あり → 検索結果 */}
            {q !== '' && (
              <>
                {searchLoading && <div className="py-10 text-center"><p className="text-sm" style={{ color: 'var(--muted)' }}>検索中…</p></div>}

                {!searchLoading && searchTab === 'hashtag' && suggestions.map(({ tag, count, isNew }) => (
                  <button
                    key={tag}
                    onClick={() => selectTag(tag)}
                    className="flex items-center gap-3 w-full px-5 py-4 active:opacity-70"
                    style={{ borderBottom: '1px solid var(--surface-2)', background: 'transparent', border: 'none', borderBottomColor: 'var(--surface-2)', borderBottomWidth: 1, borderBottomStyle: 'solid', cursor: 'pointer' }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: isNew ? 'rgba(245,158,11,0.1)' : 'rgba(230,57,70,0.08)', border: isNew ? '1.5px solid rgba(245,158,11,0.3)' : '1.5px solid rgba(230,57,70,0.2)' }}>
                      <span className="text-sm font-bold" style={{ color: isNew ? '#f59e0b' : '#E63946' }}>{isNew ? '👑' : '#'}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{tag}</p>
                      {isNew
                        ? <p className="text-xs" style={{ color: '#f59e0b' }}>オーナー募集中 · 最初のフォロワーになれます</p>
                        : <p className="text-xs" style={{ color: 'var(--muted)' }}>{count} Following</p>}
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}

                {!searchLoading && searchTab === 'user' && (
                  userResults.length === 0
                    ? <div className="py-16 text-center px-6"><p className="text-sm" style={{ color: 'var(--muted)' }}>「{q}」に一致するユーザーが見つかりません</p></div>
                    : userResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => selectUser(u)}
                        className="flex items-center gap-3 w-full px-5 py-3.5 active:opacity-70"
                        style={{ borderBottom: '1px solid var(--surface-2)', background: 'transparent', border: 'none', borderBottomColor: 'var(--surface-2)', borderBottomWidth: 1, borderBottomStyle: 'solid', cursor: 'pointer' }}
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
          </div>
        </div>
      )}
    </div>
  );
}
