'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type Conversation } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const RAINBOW = 'linear-gradient(to right, #7C6FE8 0%, #D455A8 18%, #E84040 36%, #E8A020 52%, #48C468 68%, #2890D8 84%, #7C6FE8 100%)'

// ── 型 ────────────────────────────────────────────────────────────

type Filter    = 'all' | 'friends' | 'groups';
type SheetMode = 'menu' | 'new-dm' | 'new-group' | 'bluetooth';

type Friend = {
  id:     string;
  avatar: string;
  name:   string;
  handle: string;
};

// ── 時刻フォーマット ──────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000)    return 'Now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── メインコンポーネント ──────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();
  const t = useTranslations('chat');
  const { user } = useAuth();

  const [filter,        setFilter]        = useState<Filter>('all');
  const [search,        setSearch]        = useState('');
  const [sheetMode,     setSheetMode]     = useState<SheetMode | null>(null);
  const [selectedIds,   setSelectedIds]   = useState<string[]>([]);
  const [friendSearch,  setFriendSearch]  = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [friends,       setFriends]       = useState<Friend[]>([]);
  const [pinnedIds,     setPinnedIds]     = useState<Set<string>>(new Set());
  const [mutedIds,      setMutedIds]      = useState<Set<string>>(new Set());

  // ── localStorage からピン止め/ミュート復元 ─────────────────────
  useEffect(() => {
    try {
      const p = localStorage.getItem('sync_pinned_convs');
      if (p) setPinnedIds(new Set(JSON.parse(p) as string[]));
      const m = localStorage.getItem('sync_muted_convs');
      if (m) setMutedIds(new Set(JSON.parse(m) as string[]));
    } catch { /* ignore */ }
  }, []);

  // ── 会話リスト取得 ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await (supabase as any)
        .from('conversations')
        .select(`
          id, type, name, created_at,
          conversation_members!inner (
            user_id,
            profiles (id, username, display_name, avatar_url)
          ),
          messages (
            content, created_at, user_id
          )
        `)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) { console.error('会話取得エラー:', error); setLoading(false); return; }

      const rows = (data ?? []) as any[];
      const convs: Conversation[] = rows.map((c: any) => {
        const members: any[] = c.conversation_members ?? [];
        const msgs: any[] = (c.messages ?? []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const lastMsg = msgs[0];

        if (c.type === 'dm') {
          const other = members.find((m: any) => m.user_id !== user.id);
          const prof  = other?.profiles;
          return {
            id:      c.id,
            avatar:  prof?.avatar_url   ?? '👤',
            name:    prof?.display_name ?? 'Unknown',
            handle:  prof ? `@${prof.username}` : undefined,
            preview: lastMsg?.content ?? '',
            time:    lastMsg ? fmtTime(lastMsg.created_at) : fmtTime(c.created_at),
            unread:  false,
            isGroup: false,
          };
        } else {
          const memberAvatars = members.map((m: any) => m.profiles?.avatar_url ?? '👤');
          return {
            id:           c.id,
            avatar:       memberAvatars[0] ?? '👥',
            name:         c.name ?? 'Group',
            preview:      lastMsg?.content ?? '',
            time:         lastMsg ? fmtTime(lastMsg.created_at) : fmtTime(c.created_at),
            unread:       false,
            isGroup:      true,
            memberAvatars,
          };
        }
      });

      if (!cancelled) {
        setConversations(convs);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  // ── フレンドリスト取得 ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    (supabase as any)
      .from('follows')
      .select(`
        following_id,
        profiles!follows_following_id_fkey (
          id, username, display_name, avatar_url
        )
      `)
      .eq('follower_id', user.id)
      .eq('type', 'user')
      .eq('status', 'accepted')
      .then(({ data, error }: any) => {
        if (error) { console.error('フレンド取得エラー:', error); return; }
        const list: Friend[] = (data ?? []).map((row: any) => {
          const p = row.profiles;
          return {
            id:     p?.id ?? row.following_id,
            avatar: p?.avatar_url   ?? '👤',
            name:   p?.display_name ?? p?.username ?? 'Unknown',
            handle: `@${p?.username ?? ''}`,
          };
        });
        setFriends(list);
      });
  }, [user?.id]);

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

  // ピン止め会話を先頭に
  const sortedFiltered = useMemo(() => {
    const pinned = filtered.filter(c => pinnedIds.has(c.id));
    const rest   = filtered.filter(c => !pinnedIds.has(c.id));
    return [...pinned, ...rest];
  }, [filtered, pinnedIds]);

  // ── Friends 検索（シート内） ────────────────────────────────────
  const fq = friendSearch.trim().toLowerCase();
  const visibleFriends = friends.filter(
    (f) => !fq || f.name.toLowerCase().includes(fq) || f.handle.toLowerCase().includes(fq),
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

  // ── スワイプアクション ──────────────────────────────────────────
  async function handleDelete(id: string) {
    await (supabase as any).from('conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    setPinnedIds(prev => { const n = new Set(prev); n.delete(id); localStorage.setItem('sync_pinned_convs', JSON.stringify([...n])); return n; });
    setMutedIds(prev => { const n = new Set(prev); n.delete(id); localStorage.setItem('sync_muted_convs', JSON.stringify([...n])); return n; });
  }

  function handlePin(id: string) {
    setPinnedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      localStorage.setItem('sync_pinned_convs', JSON.stringify([...n]));
      return n;
    });
  }

  function handleMute(id: string) {
    setMutedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      localStorage.setItem('sync_muted_convs', JSON.stringify([...n]));
      return n;
    });
  }

  // ── 新規DM作成 ──────────────────────────────────────────────────
  async function handleNewDM(friend: Friend) {
    if (!user) return;

    // 既存DM確認：自分が参加しているconversation_idを取得
    const { data: myConvIds } = await (supabase as any)
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    const myIds: string[] = (myConvIds ?? []).map((r: any) => r.conversation_id);

    if (myIds.length > 0) {
      // 相手も参加しているconversation_idを検索
      const { data: shared } = await (supabase as any)
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', friend.id)
        .in('conversation_id', myIds);

      const sharedIds: string[] = (shared ?? []).map((r: any) => r.conversation_id);

      if (sharedIds.length > 0) {
        // type='dm' の会話を探す
        const { data: existing } = await (supabase as any)
          .from('conversations')
          .select('id')
          .eq('type', 'dm')
          .in('id', sharedIds);

        if (existing && existing.length > 0) {
          closeSheet();
          router.push(`/chat/${existing[0].id}`);
          return;
        }
      }
    }

    // 新規DM作成
    const { data: newConv, error } = await (supabase as any)
      .from('conversations')
      .insert({ type: 'dm', created_by: user.id })
      .select('id')
      .single();

    if (error || !newConv) {
      console.error('DM作成エラー:', error);
      return;
    }

    await (supabase as any)
      .from('conversation_members')
      .insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: friend.id },
      ]);

    closeSheet();
    router.push(`/chat/${newConv.id}`);
  }

  // ── グループ作成 ────────────────────────────────────────────────
  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleCreateGroup() {
    if (selectedIds.length < 2 || !user) return;

    const memberCount = selectedIds.length + 1;
    const { data: newConv, error } = await (supabase as any)
      .from('conversations')
      .insert({ type: 'group', name: `Group (${memberCount})`, created_by: user.id })
      .select('id')
      .single();

    if (error || !newConv) {
      console.error('グループ作成エラー:', error);
      return;
    }

    await (supabase as any)
      .from('conversation_members')
      .insert([
        { conversation_id: newConv.id, user_id: user.id },
        ...selectedIds.map((id) => ({ conversation_id: newConv.id, user_id: id })),
      ]);

    closeSheet();
    router.push(`/chat/${newConv.id}`);
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {q ? `No results for "${search}"` : 'No messages yet'}
            </p>
          </div>
        ) : (
          sortedFiltered.map((c) => (
            <SwipeRow
              key={c.id}
              isPinned={pinnedIds.has(c.id)}
              isMuted={mutedIds.has(c.id)}
              onDelete={() => handleDelete(c.id)}
              onMute={() => handleMute(c.id)}
              onPin={() => handlePin(c.id)}
            >
              <button
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
                      style={{ background: RAINBOW, borderColor: 'var(--background)' }}
                    />
                  )}
                  {pinnedIds.has(c.id) && (
                    <span
                      className="absolute bottom-0 right-0 text-[10px] leading-none"
                      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                    >📌</span>
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
                      {mutedIds.has(c.id) && (
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>🔇</span>
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
            </SwipeRow>
          ))
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
                    label: t('newDm'),
                    sub: t('newDmSub'),
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
                    label: t('newGroup'),
                    sub: t('newGroupSub'),
                  },
                  {
                    mode: 'bluetooth' as SheetMode,
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
                      </svg>
                    ),
                    label: t('addNearby'),
                    sub: t('addNearbySub'),
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
                  title={t('newDm')}
                  onBack={() => openSheet('menu')}
                />
                <SheetSearchBar value={friendSearch} onChange={setFriendSearch} placeholder="Friends を検索…" />
                <div className="overflow-y-auto flex-1 pb-6">
                  {visibleFriends.length === 0 ? (
                    <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>
                      {friends.length === 0 ? 'No friends yet' : 'No results'}
                    </p>
                  ) : visibleFriends.map((f) => (
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
                  title={t('newGroup')}
                  onBack={() => openSheet('menu')}
                  action={
                    <button
                      onClick={handleCreateGroup}
                      disabled={selectedIds.length < 2}
                      className="text-sm font-bold px-3 py-1 rounded-full transition-all"
                      style={{
                        background: selectedIds.length >= 2 ? RAINBOW : 'transparent',
                        color: selectedIds.length >= 2 ? '#0d0d1a' : 'var(--muted)',
                        border: selectedIds.length >= 2 ? 'none' : '1px solid var(--surface-2)',
                      }}
                    >
                      {t('create')} {selectedIds.length >= 2 ? `(${selectedIds.length})` : ''}
                    </button>
                  }
                />

                {/* 選択済みチップ */}
                {selectedIds.length > 0 && (
                  <div
                    className="flex gap-2 px-5 py-2 overflow-x-auto"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {selectedIds.map((id) => {
                      const f = friends.find((x) => x.id === id);
                      if (!f) return null;
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
                            background: selected ? RAINBOW : 'transparent',
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
                  {t('addNearby')}
                </h3>
                <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
                  {t('bluetoothComingSoon')}
                </p>
                <p className="text-xs mb-6" style={{ color: 'rgba(136,136,170,0.6)' }}>
                  {t('bluetoothSoon')}
                </p>
                <button
                  onClick={() => openSheet('menu')}
                  className="px-8 py-3 rounded-full text-sm font-bold transition-all active:scale-95"
                  style={{ background: RAINBOW, color: '#ffffff' }}
                >
                  {t('back')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── スワイプ行 ────────────────────────────────────────────────────

function SwipeRow({
  children,
  onDelete,
  onMute,
  onPin,
  isPinned,
  isMuted,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onMute: () => void;
  onPin: () => void;
  isPinned: boolean;
  isMuted: boolean;
}) {
  const [offset,          setOffset]         = useState(0);
  const [transitioning,   setTransitioning]  = useState(false);
  const startX = useRef(0);
  const ACTION_W = 130;

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setTransitioning(false);
  }
  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    setOffset(Math.max(-ACTION_W, Math.min(ACTION_W, dx)));
  }
  function handleTouchEnd() {
    setTransitioning(true);
    if (Math.abs(offset) < 60) {
      setOffset(0);
    } else if (offset < 0) {
      setOffset(-ACTION_W);
    } else {
      setOffset(ACTION_W);
    }
  }
  function snap() { setTransitioning(true); setOffset(0); }

  const btnBase: React.CSSProperties = {
    flex: 1, border: 'none', cursor: 'pointer',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 4, fontSize: 11, fontWeight: 700, color: '#fff',
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 左アクション（右スワイプで露出）: ピン止め + 既読 */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: ACTION_W, display: 'flex' }}>
        <button onClick={() => { onPin(); snap(); }} style={{ ...btnBase, background: '#E8A020' }}>
          <span style={{ fontSize: 18 }}>📌</span>
          {isPinned ? 'ピン解除' : 'ピン止め'}
        </button>
        <button onClick={() => snap()} style={{ ...btnBase, background: '#118AB2' }}>
          <span style={{ fontSize: 18 }}>✅</span>
          既読
        </button>
      </div>

      {/* 右アクション（左スワイプで露出）: ミュート + 削除 */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W, display: 'flex' }}>
        <button onClick={() => { onMute(); snap(); }} style={{ ...btnBase, background: '#555555' }}>
          <span style={{ fontSize: 18 }}>🔇</span>
          {isMuted ? 'ミュート解除' : 'ミュート'}
        </button>
        <button onClick={() => { onDelete(); snap(); }} style={{ ...btnBase, background: '#E84040' }}>
          <span style={{ fontSize: 18 }}>🗑️</span>
          削除
        </button>
      </div>

      {/* コンテンツ（スライド） */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: transitioning ? 'transform 0.2s ease' : 'none',
          position: 'relative', zIndex: 1,
          background: 'var(--background)',
          willChange: 'transform',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
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
