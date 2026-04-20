'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const RAINBOW = 'linear-gradient(to right, #7C6FE8 0%, #D455A8 18%, #E84040 36%, #E8A020 52%, #48C468 68%, #2890D8 84%, #7C6FE8 100%)';

// ── 型定義 ────────────────────────────────────────────────────────

type NotifType = 'follow' | 'follow_request' | 'follow_accepted' | 'bubble' | 'dm' | 'reaction' | 'comment' | 'event_reminder';

interface Notif {
  id:            string;
  type:          NotifType;
  avatar:        string;
  title:         string;
  body:          string;
  time:          string;
  read:          boolean;
  userId?:       string;   // from_profile.id（UUID）— follows操作用
  userName?:     string;   // from_profile.username — プロフィール遷移用
  link?:         string;
  bubbleContext?: string;
}

// ── ヘルパー ──────────────────────────────────────────────────────

function getNotifText(type: string, userName: string): { title: string; body: string } {
  switch (type) {
    case 'follow':          return { title: 'フォロー',               body: `${userName}さんがフォローしました` };
    case 'follow_request':  return { title: 'つながり申請',           body: `${userName}さんがつながりを申請しました` };
    case 'follow_accepted': return { title: 'つながり承認',           body: `${userName}さんが申請を承認しました` };
    case 'reaction':        return { title: 'リアクション',           body: `${userName}さんがリアクションしました` };
    case 'comment':         return { title: 'コメント',               body: `${userName}さんがコメントしました` };
    case 'dm':              return { title: 'メッセージ',             body: `${userName}さんからメッセージ` };
    case 'bubble':          return { title: 'Bubble',                 body: `${userName}さんがBubbleを送りました` };
    case 'event_reminder':  return { title: 'イベントリマインダー',  body: 'イベントが近づいています' };
    default:                return { title: '通知',                   body: '' };
  }
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min  < 1)  return 'たった今';
  if (min  < 60) return `${min}分前`;
  if (hour < 24) return `${hour}時間前`;
  return `${day}日前`;
}

// ── タイプスタイル ────────────────────────────────────────────────

function typeStyle(type: NotifType) {
  switch (type) {
    case 'follow':          return { bg: 'rgba(230,57,70,0.12)',   color: '#E63946', badge: '👤' };
    case 'follow_request':  return { bg: 'rgba(124,111,232,0.12)', color: '#7C6FE8', badge: '👤' };
    case 'follow_accepted': return { bg: 'rgba(72,196,104,0.12)',  color: '#48C468', badge: '✓' };
    case 'bubble':          return { bg: 'rgba(255,107,157,0.12)', color: '#FF6B9D', badge: '🫧' };
    case 'dm':              return { bg: 'rgba(80,160,255,0.12)',  color: '#50A0FF', badge: '💬' };
    case 'event_reminder':  return { bg: 'rgba(255,180,0,0.12)',   color: '#FFB400', badge: '🔔' };
    case 'reaction':        return { bg: 'rgba(230,57,70,0.10)',   color: '#E63946', badge: '❤️' };
    case 'comment':         return { bg: 'rgba(255,160,64,0.12)',  color: '#FFA040', badge: '💬' };
  }
}

// ── フィルタータブ ────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',            tKey: 'all' },
  { key: 'follow',         tKey: 'follow' },
  { key: 'dm',             tKey: 'dm' },
  { key: 'reaction',       tKey: 'reaction' },
  { key: 'comment',        tKey: 'comment' },
  { key: 'event_reminder', tKey: 'event' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

// ── メインコンポーネント ──────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const t      = useTranslations('notifications');
  const { user } = useAuth();

  const [filter,      setFilter]      = useState<FilterKey>('all');
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [toast,       setToast]       = useState('');

  // ── データ取得 + 全件既読 ──────────────────────────────────────
  const fetchAndMarkRead = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // 通知一覧（送信者プロフィール結合）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (supabase.from('notifications') as any)
      .select(`
        id, type, read, created_at, target_id, from_user_id,
        from_profile:profiles!notifications_from_user_id_fkey (
          id, username, avatar_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (rows) {
      // reaction / comment / bubble → posts.content を取得して bubbleContext に使う
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const needsPost = (rows as any[]).filter(
        n => ['reaction', 'comment', 'bubble'].includes(n.type) && n.target_id
      );
      let postContents: Record<string, string> = {};
      if (needsPost.length > 0) {
        const ids = needsPost.map((n: any) => n.target_id as string);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: posts } = await (supabase.from('posts') as any)
          .select('id, content')
          .in('id', ids);
        if (posts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          postContents = Object.fromEntries((posts as any[]).map(p => [p.id, p.content as string]));
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Notif[] = (rows as any[]).map(n => {
        const prof     = n.from_profile;
        const userName = prof?.username ?? '';
        const { title, body } = getNotifText(n.type, userName);
        return {
          id:           n.id,
          type:         n.type as NotifType,
          avatar:       prof?.avatar_url ?? '👤',
          title,
          body,
          time:         getRelativeTime(n.created_at),
          read:         n.read,
          userId:       prof?.id,
          userName:     userName || undefined,
          link:         n.type === 'dm' && prof?.id ? `/chat/${prof.id}` : undefined,
          bubbleContext: n.target_id ? postContents[n.target_id] : undefined,
        };
      });

      setNotifs(mapped);
    }

    // 全件既読にする
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notifications') as any)
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAndMarkRead();
  }, [fetchAndMarkRead]);

  // ── ローカル既読マーク ─────────────────────────────────────────
  function markReadLocal(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  // ── フォロー承認 ───────────────────────────────────────────────
  async function handleAcceptFollow(notif: Notif, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user || !notif.userId) return;

    // pending → accepted に更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('follows') as any)
      .update({ status: 'accepted' })
      .eq('follower_id', notif.userId)
      .eq('following_id', user.id)
      .eq('type', 'user')
      .eq('status', 'pending');

    // 逆方向を INSERT（accepted）→ notify_on_follow が follow_accepted 通知を相手に送る
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('follows') as any).insert({
      follower_id:  user.id,
      following_id: notif.userId,
      type:         'user',
      status:       'accepted',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notifications') as any).update({ read: true }).eq('id', notif.id);

    setAcceptedIds(prev => new Set([...prev, notif.userId!]));
    markReadLocal(notif.id);
    setToast(t('connected'));
    setTimeout(() => setToast(''), 2000);
  }

  // ── フォロー拒否 ───────────────────────────────────────────────
  async function handleRejectFollow(notif: Notif, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user || !notif.userId) return;

    // pending 申請行を削除
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('follows') as any)
      .delete()
      .eq('follower_id', notif.userId)
      .eq('following_id', user.id)
      .eq('type', 'user')
      .eq('status', 'pending');

    await supabase.from('notifications').delete().eq('id', notif.id);
    setNotifs(prev => prev.filter(n => n.id !== notif.id));
  }

  // ── タップ ─────────────────────────────────────────────────────
  function handleTap(notif: Notif) {
    markReadLocal(notif.id);
    if (notif.type === 'dm' && notif.link) {
      router.push(notif.link);
    } else if (notif.userName) {
      router.push(`/profile/${notif.userName}`);
    }
  }

  const displayed = notifs.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'reaction') return n.type === 'reaction' || n.type === 'bubble';
    if (filter === 'follow') return n.type === 'follow' || n.type === 'follow_request' || n.type === 'follow_accepted';
    return n.type === filter;
  });
  const unreadCount  = notifs.filter(n => !n.read).length;

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--background)' }}>

      {/* ── ヘッダー ─────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center px-4 gap-3"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)',
          paddingBottom: 12,
          borderBottom: '1px solid var(--surface-2)',
          background: 'var(--background)',
        }}
      >
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform flex-shrink-0"
          style={{ background: 'var(--surface-2)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-5 h-5" style={{ color: 'var(--foreground)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        <h1 className="text-base font-black flex-1" style={{ color: 'var(--foreground)' }}>
          {t('title')}
        </h1>

        {unreadCount > 0 && (
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('unread', { count: unreadCount })}
          </span>
        )}
      </header>

      {/* ── フィルタータブ ────────────────────────────────────────── */}
      <div
        className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none flex-shrink-0"
        style={{ borderBottom: '1px solid var(--surface-2)' }}
      >
        {FILTERS.map(({ key, tKey }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="shrink-0 text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all duration-150 active:scale-95"
            style={
              filter === key
                ? { background: RAINBOW, color: '#fff', border: 'none' }
                : { background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--surface-2)' }
            }
          >
            {t(tKey as any)}
          </button>
        ))}
      </div>

      {/* ── 通知リスト ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">🔔</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('empty')}</p>
          </div>
        ) : (
          displayed.map((notif) => {
            const s          = typeStyle(notif.type);
            const isAccepted = notif.userId ? acceptedIds.has(notif.userId) : false;

            return (
              <div
                key={notif.id}
                className="w-full flex gap-3 px-4 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                style={{
                  borderBottom: '1px solid var(--surface-2)',
                  background: notif.read ? 'transparent' : 'rgba(230,57,70,0.03)',
                }}
                onClick={() => handleTap(notif)}
              >
                {/* アバター + バッジ */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
                    style={{ background: s.bg }}
                  >
                    {notif.avatar}
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{ background: 'var(--surface-2)', border: '1.5px solid var(--background)' }}
                  >
                    {s.badge}
                  </span>
                </div>

                {/* 本文エリア */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--foreground)' }}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: 'var(--muted)' }}>
                      {notif.time}
                    </span>
                  </div>
                  <p className="text-[13px] leading-snug" style={{ color: 'var(--muted)' }}>
                    {notif.body}
                  </p>

                  {/* Bubble コンテキスト（元投稿の引用） */}
                  {notif.bubbleContext && (
                    <p
                      className="text-[12px] mt-1.5 leading-relaxed px-2.5 py-1.5 rounded-lg"
                      style={{ background: 'var(--surface-2)', color: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-line' }}
                    >
                      {notif.bubbleContext}
                    </p>
                  )}

                  {/* Follow: ✓ / × ボタン */}
                  {notif.type === 'follow_request' && notif.userId && !isAccepted && (
                    <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleAcceptFollow(notif, e)}
                        className="flex items-center justify-center w-8 h-8 rounded-full active:scale-95 transition-transform"
                        style={{ background: '#E84040', color: '#ffffff' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleRejectFollow(notif, e)}
                        className="flex items-center justify-center w-8 h-8 rounded-full active:scale-95 transition-transform"
                        style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Follow: 承認済み */}
                  {notif.type === 'follow' && notif.userId && isAccepted && (
                    <span
                      className="inline-block mt-2 text-[11px] font-bold px-3 py-1 rounded-full"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                    >
                      {t('friend')}
                    </span>
                  )}

                  {/* DM: チャットを開くヒント */}
                  {notif.type === 'dm' && (
                    <span
                      className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: s.bg, color: s.color }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      {t('openChat')}
                    </span>
                  )}
                </div>

                {/* 未読ドット */}
                {!notif.read && (
                  <div className="flex-shrink-0 mt-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#E63946' }} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── トースト ─────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(20,20,42,0.95)', border: '1px solid rgba(255,26,26,0.4)',
          color: '#fff', fontSize: 13, fontWeight: 600,
          padding: '10px 20px', borderRadius: 24, zIndex: 300,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
