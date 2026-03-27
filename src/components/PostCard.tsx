'use client';

import { useState, useRef, useEffect } from 'react';
import type { Post } from '@/lib/mockData';

// ── リアクション絵文字 ────────────────────────────────────────────
const REACTION_DEFAULTS = ['❤️', '👍', '👏', '😂', '😭'];
const REACTION_ALL = [
  '❤️','👍','👏','😂','😭','🔥','😍','🥹','😊','🤩',
  '😎','🥰','😆','🤣','😱','😢','😤','🫀','💫','⚡',
  '✨','💥','🙏','💪','🤝','👀','🫶','💯','🎉','🎊',
  '🌊','💎','👑','🚀','🌸','🍀','⭐','🌙','☀️','🌈',
  '🎵','🎶','🎸','🏆','🥇','💌','📣','🔔','💬','🫧',
];

function useCountdown(expiresAt: number) {
  const [remaining, setRemaining] = useState(expiresAt - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = expiresAt - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const d = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const h = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((remaining % (1000 * 60)) / 1000);

  return { d, h, m, s, expired: remaining <= 0 };
}

function CountdownTimer({ expiresAt }: { expiresAt: number }) {
  const { d, h, m, s, expired } = useCountdown(expiresAt);

  if (expired) return <span style={{ color: '#ff4444', fontSize: 12 }}>期限切れ</span>;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: '#111',
      borderRadius: 8,
      padding: '4px 8px',
    }}>
      {([{ value: d, label: 'd' }, { value: h, label: 'h' }, { value: m, label: 'm' }, { value: s, label: 's' }] as const).map(({ value, label }, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={{ color: '#C9A84C', fontWeight: 'bold' }}>:</span>}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 20,
              fontFamily: 'monospace',
              minWidth: 24,
              textAlign: 'center',
            }}>
              {String(value).padStart(2, '0')}
            </span>
            <span style={{ color: '#888', fontSize: 10 }}>{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface FloatEmoji { id: number; emoji: string; x: number; delay: number }

interface PostCardProps {
  post:        Post;
  onReply?:    (post: Post) => void;
  onUserClick?: () => void;
}

export default function PostCard({ post, onReply, onUserClick }: PostCardProps) {
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [expandAll,    setExpandAll]    = useState(false);
  const [floatEmojis,  setFloatEmojis]  = useState<FloatEmoji[]>([]);
  const floatId = useRef(0);

  function handleReact(emoji: string) {
    setReactedEmoji(emoji);
    setShowPicker(false);
    setExpandAll(false);
    const newEmojis: FloatEmoji[] = Array.from({ length: 4 }, (_, i) => ({
      id:    floatId.current++,
      emoji,
      x:     (Math.random() - 0.5) * 80,
      delay: i * 85,
    }));
    setFloatEmojis((prev) => [...prev, ...newEmojis]);
    const ids = new Set(newEmojis.map((e) => e.id));
    setTimeout(() => setFloatEmojis((prev) => prev.filter((e) => !ids.has(e.id))), 1200);
  }

  return (
    <article className="border-b" style={{ borderColor: 'var(--surface-2)' }}>
      <div className="px-4 py-4">

        {/* ヘッダー: アバター + ユーザー情報 + 時刻 */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 cursor-pointer active:opacity-70"
            style={{ background: 'var(--surface-2)' }}
            onClick={onUserClick}
          >
            {post.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <div
                className="flex items-baseline gap-1.5 min-w-0 cursor-pointer active:opacity-70"
                onClick={onUserClick}
              >
                <span className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
                  {post.name}
                </span>
                <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                  {post.handle}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {post.time}
                </span>
                {post.expiresAt != null && <CountdownTimer expiresAt={post.expiresAt} />}
              </div>
            </div>
          </div>
        </div>

        {/* 本文 */}
        <p
          className="text-sm leading-relaxed whitespace-pre-line mb-3 pl-12"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          {post.content}
        </p>

        {/* ハッシュタグ */}
        <div className="flex flex-wrap gap-1.5 mb-3 pl-12">
          {post.hashtags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-0.5 rounded-full cursor-pointer transition-colors duration-150"
              style={{
                background: 'rgba(201,168,76,0.1)',
                color: 'var(--brand)',
                border: '1px solid rgba(201,168,76,0.25)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* アクションバー */}
        <div className="relative pl-12">
          <div className="flex items-center gap-5">

            {/* Reply ボタン */}
            <button
              className="flex items-center gap-1.5 transition-colors duration-150 active:opacity-60"
              style={{ color: 'var(--muted)' }}
              onClick={() => onReply?.(post)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
                />
              </svg>
              <span className="text-xs">reply</span>
            </button>

            {/* リアクションボタン */}
            <button
              className="transition-all active:scale-90"
              style={{
                color: reactedEmoji ? 'var(--brand)' : 'var(--muted)',
                fontSize: reactedEmoji ? 16 : undefined,
              }}
              onClick={() => { setShowPicker((v) => !v); setExpandAll(false); }}
            >
              {reactedEmoji ?? (
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round"
                    d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                  />
                </svg>
              )}
            </button>

            {/* シェアボタン */}
            <button
              className="ml-auto transition-colors active:opacity-60"
              style={{ color: 'var(--muted)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round"
                  d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                />
              </svg>
            </button>
          </div>

          {/* 絵文字浮き上がり */}
          {floatEmojis.map((fe) => (
            <div
              key={fe.id}
              className="absolute pointer-events-none select-none"
              style={{
                bottom: 16,
                left: `calc(50% + ${fe.x}px)`,
                fontSize: 22,
                lineHeight: 1,
                animation: `emojiFlyAnim 0.9s ${fe.delay}ms ease-out forwards`,
              }}
            >
              {fe.emoji}
            </div>
          ))}

          {/* インライン絵文字ピッカー */}
          {showPicker && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5">
                {REACTION_DEFAULTS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="flex-1 flex items-center justify-center py-2 rounded-xl text-lg active:scale-90 transition-transform"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => setExpandAll((v) => !v)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold active:scale-90 transition-transform flex-shrink-0"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)', color: 'var(--muted)' }}
                >
                  •••
                </button>
              </div>
              {expandAll && (
                <div
                  className="flex flex-wrap gap-1 mt-1.5 max-h-36 overflow-y-auto p-2 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
                >
                  {REACTION_ALL.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      className="w-9 h-9 flex items-center justify-center text-lg rounded-lg active:scale-90 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </article>
  );
}
