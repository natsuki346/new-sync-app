'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CONVERSATIONS, type Conversation } from '@/lib/mockData';

const RAINBOW = 'linear-gradient(to right, #7C6FE8 0%, #D455A8 18%, #E84040 36%, #E8A020 52%, #48C468 68%, #2890D8 84%, #7C6FE8 100%)'

// ── 型 ────────────────────────────────────────────────────────────

type Filter    = 'all' | 'friends' | 'groups';
type SheetMode = 'menu' | 'new-dm' | 'new-group' | 'bluetooth';

// ── Friends マスタ ────────────────────────────────────────────────

const FRIENDS_LIST = [
  { id: 'u1', avatar: '🌸', name: 'yuki',  handle: '@yuki'  },
  { id: 'u2', avatar: '🎨', name: 'kai',   handle: '@kai'   },
  { id: 'u3', avatar: '🎵', name: 'mio',   handle: '@mio'   },
  { id: 'u4', avatar: '📸', name: 'ren',   handle: '@ren'   },
  { id: 'u5', avatar: '🎞️', name: 'tomo',  handle: '@tomo'  },
  { id: 'u6', avatar: '☕', name: 'nagi',  handle: '@nagi'  },
  { id: 'u7', avatar: '💻', name: 'mai',   handle: '@mai'   },
  { id: 'u8', avatar: '🌙', name: 'luna',  handle: '@luna'  },
];

// ── メインコンポーネント ──────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();

  const [filter,        setFilter]        = useState<Filter>('all');
  const [search,        setSearch]        = useState('');
  const [sheetMode,     setSheetMode]     = useState<SheetMode | null>(null);
  const [selectedIds,   setSelectedIds]   = useState<string[]>([]);
  const [friendSearch,  setFriendSearch]  = useState('');
  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS);

  // ── 検索フィルター ──────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const filtered = useMemo(() =>
    conversations.filter((c) => {
      const tabMatch =
        filter === 'friends' ? !c.isGroup :
        filter === 'groups'  ?  c.isGroup : true;
      if (!tabMatch) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q)
      );
    }),
    [conversations, filter, q],
  );

  // ── Friends 検索（シート内） ────────────────────────────────────
  const fq = friendSearch.trim().toLowerCase();
  const visibleFriends = FRIENDS_LIST.filter(
    (f) => !fq || f.name.includes(fq) || f.handle.includes(fq),
  );

  // ── シート操作 ──────────────────────────────────────────────────
  function openSheet(mode: SheetMode) {
    setFriendSearch('');
    setSelectedIds([]);
    setSheetMode(mode);
  }

  function closeSheet() {
    setSheetMode(null);
    setFriendSearch('');
    setSelectedIds([]);
  }

  // ── 新規DM作成 ──────────────────────────────────────────────────
  function handleNewDM(friend: typeof FRIENDS_LIST[0]) {
    const existing = conversations.find(
      (c) => !c.isGroup && c.handle === friend.handle,
    );
    if (existing) {
      closeSheet();
      router.push(`/chat/${existing.id}`);
      return;
    }
    const newId = `dm-${Date.now()}`;
    setConversations((prev) => [{
      id: newId, avatar: friend.avatar, name: friend.name,
      handle: friend.handle, preview: 'New conversation',
      time: 'Now', unread: false,
    }, ...prev]);
    closeSheet();
    router.push(`/chat/${newId}`);
  }

  // ── グループ作成 ────────────────────────────────────────────────
  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleCreateGroup() {
    if (selectedIds.length < 2) return;
    const members = FRIENDS_LIST.filter((f) => selectedIds.includes(f.id));
    const newId = `grp-${Date.now()}`;
    setConversations((prev) => [{
      id: newId,
      avatar: members[0].avatar,
      name: members.map((m) => m.name).join(', '),
      preview: 'Group created',
      time: 'Now',
      unread: false,
      isGroup: true,
      memberAvatars: members.map((m) => m.avatar),
    }, ...prev]);
    closeSheet();
    router.push(`/chat/${newId}`);
  }

  const TABS: { key: Filter; label: string }[] = [
    { key: 'all',     label: 'All'     },
    { key: 'friends', label: 'Friends' },
    { key: 'groups',  label: 'Groups'  },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── ヘッダー ─────────────────────────────────────────────── */}
      <header
        className="px-4 pt-12 pb-3 flex items-center gap-3 flex-shrink-0"
        style={{ background: 'var(--background)' }}
      >
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center flex-shrink-0"
          style={{ color: 'var(--foreground)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <h1
          className="text-lg font-bold tracking-wide flex-1"
          style={{ color: 'var(--foreground)' }}
        >
          Messages
        </h1>

        {/* + ボタン */}
        <button
          onClick={() => openSheet('menu')}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{
            background: RAINBOW,
            color: '#ffffff',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {/* ── 検索バー ──────────────────────────────────────────────── */}
      <div
        className="px-4 pb-3 flex-shrink-0"
        style={{ background: 'var(--background)' }}
      >
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--muted)', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="22" y2="22" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: 'var(--foreground)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
              style={{ color: 'var(--muted)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── フィルタータブ ────────────────────────────────────────── */}
      <div
        className="flex border-b px-5 flex-shrink-0"
        style={{ borderColor: 'var(--surface-2)' }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="mr-6 py-3 text-sm font-medium relative transition-colors duration-200"
            style={filter === key ? {
              backgroundImage: RAINBOW,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            } : {
              color: 'var(--muted)',
            }}
          >
            {label}
            {filter === key && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: RAINBOW }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── 会話リスト ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => router.push(`/chat/${c.id}`)}
            className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 text-left active:opacity-70"
            style={{ borderBottom: '1px solid var(--surface-2)' }}
          >
            {/* アバター */}
            <div className="relative flex-shrink-0">
              {c.isGroup ? (
                <GroupAvatar avatars={c.memberAvatars ?? []} />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {c.avatar}
                </div>
              )}
              {c.unread && (
                <span
                  className="absolute top-0 right-0 w-3 h-3 rounded-full border-2"
                  style={{
                    background: RAINBOW,
                    borderColor: 'var(--background)',
                  }}
                />
              )}
            </div>

            {/* テキスト */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span
                    className="text-sm font-semibold truncate"
                    style={{ color: c.unread ? 'var(--foreground)' : 'rgba(255,255,255,0.6)' }}
                  >
                    {c.name}
                  </span>
                  {c.handle && (
                    <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                      {c.handle}
                    </span>
                  )}
                  {c.isGroup && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: 'rgba(255,26,26,0.12)',
                        color: 'var(--brand)',
                        border: '1px solid rgba(255,26,26,0.25)',
                      }}
                    >
                      Group
                    </span>
                  )}
                </div>
                <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--muted)' }}>
                  {c.time}
                </span>
              </div>
              <p
                className="text-xs truncate"
                style={{
                  color: c.unread ? 'rgba(255,255,255,0.75)' : 'var(--muted)',
                  fontWeight: c.unread ? 500 : 400,
                }}
              >
                {c.preview}
              </p>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {q ? `No results for "${search}"` : 'No messages yet'}
            </p>
          </div>
        )}
      </main>

      {/* ── ボトムシート ─────────────────────────────────────────── */}
      {sheetMode && (
        <>
          {/* オーバーレイ */}
          <div
            className="absolute inset-0 z-40 bg-black/60"
            onClick={closeSheet}
          />

          {/* シート本体 */}
          <div
            className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden sheet-animate"
            style={{ background: '#1a1a2e' }}
          >
            {/* ハンドルバー */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* ── メニュー ── */}
            {sheetMode === 'menu' && (
              <div className="pb-8">
                <p className="text-xs font-semibold px-5 pt-2 pb-3" style={{ color: 'var(--muted)' }}>
                  NEW CONVERSATION
                </p>

                {[
                  {
                    mode: 'new-dm' as SheetMode,
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    ),
                    label: '新規DM',
                    sub: 'Friends一覧から選択',
                  },
                  {
                    mode: 'new-group' as SheetMode,
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    ),
                    label: 'グループ作成',
                    sub: 'Friends複数選択',
                  },
                  {
                    mode: 'bluetooth' as SheetMode,
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
                      </svg>
                    ),
                    label: '現場で友達追加',
                    sub: 'Bluetooth で近くの人と繋がる',
                  },
                ].map(({ mode, icon, label, sub }) => (
                  <button
                    key={mode}
                    onClick={() => openSheet(mode)}
                    className="w-full flex items-center gap-4 px-5 py-4 transition-colors active:opacity-60"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'rgba(255,26,26,0.12)',
                        color: 'var(--brand)',
                      }}
                    >
                      {icon}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {label}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {sub}
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="ml-auto" style={{ color: 'var(--muted)' }}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {/* ── 新規DM ── */}
            {sheetMode === 'new-dm' && (
              <div className="flex flex-col" style={{ maxHeight: '65dvh' }}>
                <SheetHeader
                  title="新規DM"
                  onBack={() => openSheet('menu')}
                />
                <SheetSearchBar value={friendSearch} onChange={setFriendSearch} placeholder="Friends を検索…" />
                <div className="overflow-y-auto flex-1 pb-6">
                  {visibleFriends.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleNewDM(f)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors active:opacity-60"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        {f.avatar}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{f.name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{f.handle}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="ml-auto" style={{ color: 'var(--muted)' }}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── グループ作成 ── */}
            {sheetMode === 'new-group' && (
              <div className="flex flex-col" style={{ maxHeight: '65dvh' }}>
                <SheetHeader
                  title="グループ作成"
                  onBack={() => openSheet('menu')}
                  action={
                    <button
                      onClick={handleCreateGroup}
                      disabled={selectedIds.length < 2}
                      className="text-sm font-bold px-3 py-1 rounded-full transition-all"
                      style={{
                        background: selectedIds.length >= 2 ? 'var(--brand)' : 'transparent',
                        color: selectedIds.length >= 2 ? '#0d0d1a' : 'var(--muted)',
                        border: selectedIds.length >= 2 ? 'none' : '1px solid var(--surface-2)',
                      }}
                    >
                      作成 {selectedIds.length >= 2 ? `(${selectedIds.length})` : ''}
                    </button>
                  }
                />

                {/* 選択済みチップ */}
                {selectedIds.length > 0 && (
                  <div
                    className="flex gap-2 px-5 py-2 overflow-x-auto"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', scrollbarWidth: 'none' }}
                  >
                    {selectedIds.map((id) => {
                      const f = FRIENDS_LIST.find((x) => x.id === id)!;
                      return (
                        <button
                          key={id}
                          onClick={() => toggleMember(id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 transition-all"
                          style={{
                            background: 'rgba(255,26,26,0.15)',
                            border: '1px solid rgba(255,26,26,0.35)',
                            color: 'var(--brand)',
                          }}
                        >
                          <span className="text-sm">{f.avatar}</span>
                          <span className="text-xs font-medium">{f.name}</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                          >
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                )}

                <SheetSearchBar value={friendSearch} onChange={setFriendSearch} placeholder="Friends を検索…" />

                <div className="overflow-y-auto flex-1 pb-6">
                  {visibleFriends.map((f) => {
                    const selected = selectedIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleMember(f.id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors active:opacity-60"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          {f.avatar}
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{f.name}</p>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>{f.handle}</p>
                        </div>
                        {/* チェックボックス */}
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            background: selected ? 'var(--brand)' : 'transparent',
                            border: selected ? 'none' : '2px solid var(--surface-2)',
                          }}
                        >
                          {selected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                              stroke="#ffffff" strokeWidth="3"
                              strokeLinecap="round" strokeLinejoin="round"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Bluetooth（未実装） ── */}
            {sheetMode === 'bluetooth' && (
              <div className="flex flex-col items-center px-6 pt-4 pb-10 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'rgba(255,26,26,0.12)', color: 'var(--brand)' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
                  </svg>
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                  現場で友達追加
                </h3>
                <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
                  Bluetooth 機能は近日公開予定です。
                </p>
                <p className="text-xs mb-6" style={{ color: 'rgba(136,136,170,0.6)' }}>
                  同じ場所にいる人と直接繋がれるようになります。
                </p>
                <button
                  onClick={() => openSheet('menu')}
                  className="px-8 py-3 rounded-full text-sm font-bold transition-all active:scale-95"
                  style={{ background: 'var(--brand)', color: '#ffffff' }}
                >
                  戻る
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── 共通シートヘッダー ────────────────────────────────────────────

function SheetHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        onClick={onBack}
        className="w-7 h-7 flex items-center justify-center flex-shrink-0"
        style={{ color: 'var(--muted)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
      </button>
      <p className="text-sm font-bold flex-1" style={{ color: 'var(--foreground)' }}>
        {title}
      </p>
      {action}
    </div>
  );
}

// ── シート内検索バー ──────────────────────────────────────────────

function SheetSearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--muted)', flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="22" y2="22" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent"
          style={{ color: 'var(--foreground)' }}
        />
        {value && (
          <button onClick={() => onChange('')} style={{ color: 'var(--muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── グループアバター（チャット一覧用） ────────────────────────────

function GroupAvatar({ avatars }: { avatars: string[] }) {
  const shown = avatars.slice(0, 3);
  const offsets = [
    { top: 0,  left: 0  },
    { top: 0,  left: 14 },
    { top: 14, left: 7  },
  ];
  return (
    <div className="relative w-12 h-12">
      {shown.map((av, i) => (
        <div
          key={i}
          className="absolute w-7 h-7 rounded-full flex items-center justify-center border-2"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--background)',
            top: offsets[i]?.top ?? 0,
            left: offsets[i]?.left ?? 0,
            fontSize: 14,
          }}
        >
          {av}
        </div>
      ))}
    </div>
  );
}
