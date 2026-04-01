'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const RAINBOW = 'linear-gradient(to right, #7C6FE8 0%, #D455A8 18%, #E84040 36%, #E8A020 52%, #48C468 68%, #2890D8 84%, #7C6FE8 100%)'

// ── 型定義 ────────────────────────────────────────────────────────

type NotifType = 'follow' | 'bubble' | 'dm' | 'reaction' | 'comment' | 'event_reminder';

interface Notif {
  id: string;
  type: NotifType;
  avatar: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  userId?: string;
  userName?: string;
  link?: string;
  bubbleContext?: string;
}

// ── モックデータ ──────────────────────────────────────────────────

const MOCK_NOTIFS: Notif[] = [
  {
    id: 'n1', type: 'follow',
    avatar: '🌸', title: 'フォローリクエスト',
    body: 'yuki があなたをフォローしました',
    time: '3分前', read: false,
    userId: 'yuki', userName: 'yuki',
  },
  {
    id: 'n2', type: 'reaction',
    avatar: '🎨', title: 'リアクション',
    body: 'kai があなたの投稿に ❤️ しました',
    time: '12分前', read: false,
    userId: 'kai', userName: 'kai',
    bubbleContext: 'Last night\'s show was everything.\nThe setlist was so perfect.',
  },
  {
    id: 'n3', type: 'dm',
    avatar: '🌺', title: '新しいDM',
    body: 'hana: 「今日のライブどうだった？」',
    time: '28分前', read: false,
    userId: 'hana', userName: 'hana',
    link: '/chat/hana',
  },
  {
    id: 'n4', type: 'event_reminder',
    avatar: '📅', title: 'イベントリマインダー',
    body: '「SYNC LIVE vol.3 渋谷」まであと3日！',
    time: '1時間前', read: false,
  },
  {
    id: 'n5', type: 'comment',
    avatar: '🎵', title: '新しいコメント',
    body: 'mio があなたの投稿にコメントしました: 「わかる、この曲ずっと聴いてる」',
    time: '2時間前', read: true,
    userId: 'mio', userName: 'mio',
    bubbleContext: '毎日続けていることがある。\nそれが自分の一部になってきた。',
  },
  {
    id: 'n6', type: 'bubble',
    avatar: '🎧', title: 'Bubble リアクション',
    body: 'ryu があなたのBubbleに共鳴しました ✨',
    time: '昨日', read: true,
    userId: 'ryu', userName: 'ryu',
    bubbleContext: '音楽の話がしたい気分。\n#music #jprock',
  },
  {
    id: 'n7', type: 'follow',
    avatar: '☕', title: 'フォローリクエスト',
    body: 'nagi があなたをフォローしました',
    time: '昨日', read: true,
    userId: 'nagi', userName: 'nagi',
  },
  {
    id: 'n8', type: 'dm',
    avatar: '🎨', title: '新しいDM',
    body: 'kai: 「そのデザイン本おすすめだよ」',
    time: '2日前', read: true,
    userId: 'kai', userName: 'kai',
    link: '/chat/kai',
  },
];

// ── タイプスタイル ────────────────────────────────────────────────

function typeStyle(type: NotifType) {
  switch (type) {
    case 'follow':         return { bg: 'rgba(230,57,70,0.12)',   color: '#E63946',  badge: '👤' };
    case 'bubble':         return { bg: 'rgba(255,107,157,0.12)', color: '#FF6B9D',  badge: '🫧' };
    case 'dm':             return { bg: 'rgba(80,160,255,0.12)',  color: '#50A0FF',  badge: '💬' };
    case 'event_reminder': return { bg: 'rgba(255,180,0,0.12)',   color: '#FFB400',  badge: '🔔' };
    case 'reaction':       return { bg: 'rgba(230,57,70,0.10)',   color: '#E63946',  badge: '❤️' };
    case 'comment':        return { bg: 'rgba(255,160,64,0.12)',  color: '#FFA040',  badge: '💬' };
  }
}

// ── フィルタータブ ────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',            label: 'すべて' },
  { key: 'follow',         label: 'フォロー' },
  { key: 'dm',             label: 'DM' },
  { key: 'reaction',       label: 'リアクション' },
  { key: 'comment',        label: 'コメント' },
  { key: 'bubble',         label: 'Bubble' },
  { key: 'event_reminder', label: 'イベント' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

// ── メインコンポーネント ──────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter]         = useState<FilterKey>('all');
  const [notifs, setNotifs]         = useState<Notif[]>(MOCK_NOTIFS);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [toast, setToast]           = useState('');

  const displayed = notifs.filter(
    (n) => filter === 'all' || n.type === filter
  );

  const unreadCount = notifs.filter((n) => !n.read).length;

  function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  function handleAcceptFollow(notif: Notif, e: React.MouseEvent) {
    e.stopPropagation();
    if (!notif.userId) return;
    setAcceptedIds((prev) => new Set([...prev, notif.userId!]));
    markRead(notif.id);
    setToast('つながりました！');
    setTimeout(() => setToast(''), 2000);
  }

  function handleRejectFollow(notif: Notif, e: React.MouseEvent) {
    e.stopPropagation();
    setNotifs((prev) => prev.filter((n) => n.id !== notif.id));
  }

  function handleTap(notif: Notif) {
    markRead(notif.id);
    if (notif.type === 'dm' && notif.link) {
      router.push(notif.link);
    } else if (notif.userId) {
      router.push(`/profile/${notif.userId}`);
    }
  }

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
          通知
        </h1>

        {unreadCount > 0 && (
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            未読 {unreadCount}件
          </span>
        )}
      </header>

      {/* ── フィルタータブ ────────────────────────────────────────── */}
      <div
        className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none flex-shrink-0"
        style={{ borderBottom: '1px solid var(--surface-2)' }}
      >
        {FILTERS.map(({ key, label }) => (
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
            {label}
          </button>
        ))}
      </div>

      {/* ── 通知リスト ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-20">
        {displayed.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">🔔</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>通知はありません</p>
          </div>
        ) : (
          displayed.map((notif) => {
            const s = typeStyle(notif.type);
            const isFollowed = notif.userId ? acceptedIds.has(notif.userId) : false;

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

                  {/* Bubble コンテキスト */}
                  {notif.bubbleContext && (
                    <p
                      className="text-[12px] mt-1.5 leading-relaxed px-2.5 py-1.5 rounded-lg"
                      style={{ background: 'var(--surface-2)', color: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-line' }}
                    >
                      {notif.bubbleContext}
                    </p>
                  )}

                  {/* Follow: ✓ / × ボタン */}
                  {notif.type === 'follow' && notif.userId && !isFollowed && (
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
                  {notif.type === 'follow' && notif.userId && isFollowed && (
                    <span
                      className="inline-block mt-2 text-[11px] font-bold px-3 py-1 rounded-full"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                    >
                      友達
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
                      チャットを開く
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
