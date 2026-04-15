'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Post } from '@/lib/mockData';
import ReactionPicker from './ReactionPicker';
import BottomSheet from './BottomSheet';
import { translateText } from '@/lib/translation';

const RAINBOW = 'linear-gradient(to right, #7C6FE8 0%, #D455A8 18%, #E84040 36%, #E8A020 52%, #48C468 68%, #2890D8 84%, #7C6FE8 100%)';

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
  const t = useTranslations('common');

  if (expired) return <span style={{ color: '#ff4444', fontSize: 12 }}>{t('expired')}</span>;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--bg-secondary)',
      borderRadius: 8,
      padding: '4px 8px',
    }}>
      {([{ value: d, label: 'd' }, { value: h, label: 'h' }, { value: m, label: 'm' }, { value: s, label: 's' }] as const).map(({ value, label }, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={{ color: '#FF1A1A', fontWeight: 'bold' }}>:</span>}
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

function stripHashtags(text: string): string {
  return text.replace(/#[\w\u3040-\u9fff]+/g, '').replace(/\s+/g, ' ').trim();
}

interface PostCardProps {
  post:                  Post;
  onReply?:              (post: Post) => void;
  onUserClick?:          () => void;
  onHashtagClick?:       (tag: string) => void;
  onReact?:              (emoji: string) => void;
  cardColor?:            string;
  isReplyLocked?:        boolean;
  /** true のとき、リアクションボタンをグレーアウトして onReactionLocked を呼ぶ */
  isReactionLocked?:     boolean;
  /** リアクションが locked 状態でタップされたときのコールバック（トースト表示などに使う） */
  onReactionLocked?:     () => void;
  hashtagBorderColor?:   string;
  initialReactedEmoji?:  string | null;
  reactionCount?:        number;
}

export default function PostCard({ post, onReply, onUserClick, onHashtagClick, onReact, cardColor, isReplyLocked, isReactionLocked, onReactionLocked, hashtagBorderColor, initialReactedEmoji, reactionCount }: PostCardProps) {

  const hasBg     = cardColor !== undefined && cardColor !== '';
  const bgColor   = hasBg ? cardColor : 'var(--surface)';
  const bdColor   = hasBg && cardColor !== 'transparent' ? 'rgba(255,255,255,0.15)' : 'var(--surface-2)';

  const hashtagColor = typeof window !== 'undefined'
    ? localStorage.getItem('sync_hashtag_color') || ''
    : '';

  // ── 翻訳機能 ──────────────────────────────────────────────────
  const [isTranslated, setIsTranslated]     = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating]   = useState(false);

  async function handleTranslate() {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }
    if (translatedText) {
      setIsTranslated(true);
      return;
    }
    setIsTranslating(true);
    try {
      const result = await translateText(stripHashtags(post.content));
      setTranslatedText(result);
      setIsTranslated(true);
    } catch {
      // 翻訳失敗時は元テキストのまま
    } finally {
      setIsTranslating(false);
    }
  }

  // ── 共有機能 ──────────────────────────────────────────────────
  const [showShare, setShowShare] = useState(false);
  const [shareToast, setShareToast] = useState('');

  function showToast(msg: string) {
    setShareToast(msg);
    setTimeout(() => setShareToast(''), 2500);
  }

  const shareUrl  = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}` : '';
  const shareText = post.content;

  const SHARE_ITEMS = [
    {
      icon: '🔗',
      label: 'リンクをコピー',
      action: async () => {
        await navigator.clipboard.writeText(shareUrl);
        setShowShare(false);
        showToast('リンクをコピーしました！');
      },
    },
    {
      icon: '𝕏',
      label: 'X（Twitter）',
      action: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        setShowShare(false);
      },
    },
    {
      icon: '💬',
      label: 'LINE',
      action: () => {
        window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`, '_blank');
        setShowShare(false);
      },
    },
    {
      icon: '📘',
      label: 'Facebook',
      action: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
        setShowShare(false);
      },
    },
  ];

  return (
    <article
      style={{
        margin:       '6px 12px',
        borderRadius: 20,
        border:       `2px solid ${bdColor}`,
        background:   bgColor,
        overflow:     'hidden',
      }}
    >
      <div className="px-5 py-4">

        {/* ヘッダー: アバター + ユーザー情報 */}
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
                className="flex flex-col min-w-0 cursor-pointer active:opacity-70"
                onClick={onUserClick}
              >
                <span style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: 14 }}>
                  {post.name}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 11, opacity: 0.6 }}>
                  {post.handle}
                </span>
              </div>
              {post.expiresAt != null && (
                <div className="flex-shrink-0">
                  <CountdownTimer expiresAt={post.expiresAt} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 本文（#タグ部分を除いて表示） */}
        <p
          className="text-sm leading-relaxed whitespace-pre-line mb-2 pl-12"
          style={{ color: 'var(--foreground-sub, var(--foreground))' }}
        >
          {isTranslated ? translatedText : stripHashtags(post.content)}
        </p>

        {/* 翻訳ボタン */}
        <div className="pl-12 mb-2">
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          4,
              background:   'none',
              border:       '1px solid rgb(var(--border-rgb))',
              borderRadius: 20,
              color:        isTranslated ? 'rgba(100,160,255,0.9)' : 'var(--muted)',
              fontSize:     11,
              padding:      '2px 10px',
              cursor:       isTranslating ? 'default' : 'pointer',
              transition:   'color 0.15s, border-color 0.15s',
            }}
          >
            {isTranslating ? (
              <>
                <span style={{
                  display:     'inline-block',
                  width:       10,
                  height:      10,
                  border:      '1.5px solid rgb(var(--border-rgb))',
                  borderTop:   '1.5px solid var(--foreground)',
                  borderRadius:'50%',
                  animation:   'spin 0.7s linear infinite',
                }} />
                翻訳中…
              </>
            ) : isTranslated ? '元の言語に戻す' : '翻訳'}
          </button>
        </div>

        {/* ハッシュタグエリア */}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 pl-12">
            {post.hashtags.map((tag) => (
              <span
                key={tag}
                style={(hashtagColor || hashtagBorderColor) ? {
                  background: 'transparent',
                  border: `1.5px solid ${hashtagColor || hashtagBorderColor}`,
                  color: 'var(--foreground)',
                  padding: '2px 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-block',
                  cursor: 'pointer',
                } : {
                  background: 'linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(90deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF,#9B59B6) border-box',
                  border: '1.5px solid transparent',
                  color: 'var(--foreground)',
                  padding: '2px 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-block',
                  cursor: 'pointer',
                }}
                onClick={(e) => { e.stopPropagation(); onHashtagClick?.(tag); }}
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}


        {/* アクションバー */}
        <div className="relative pl-12">
          <div className="flex items-center gap-5">

            {/* リアクションピッカー / ロック状態 */}
            {isReactionLocked ? (
              <button
                className="flex items-center transition-colors duration-150"
                style={{ color: 'rgba(136,136,170,0.35)', cursor: 'default' }}
                onClick={() => onReactionLocked?.()}
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round"
                    d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                  />
                </svg>
              </button>
            ) : (
              <ReactionPicker
                hashtagId={post.hashtags[0] ?? ''}
                postId={post.id}
                onReact={(emoji) => onReact?.(emoji)}
                initialEmoji={initialReactedEmoji}
                reactionCount={reactionCount}
              />
            )}

            {/* Reply ボタン */}
            <button
              className="flex items-center transition-colors duration-150"
              style={{
                color: isReplyLocked ? 'rgba(136,136,170,0.35)' : 'var(--muted)',
                cursor: isReplyLocked ? 'default' : 'pointer',
              }}
              onClick={() => onReply?.(post)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
                />
              </svg>
            </button>

            {/* シェアボタン */}
            <button
              className="ml-auto transition-colors active:opacity-60"
              style={{ color: 'var(--muted)' }}
              onClick={() => setShowShare(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round"
                  d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                />
              </svg>
            </button>
          </div>

        </div>

      </div>

      {/* ── トースト ── */}
      {shareToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'var(--surface)',
            color: 'var(--foreground)',
            fontSize: 13,
            fontWeight: 500,
            padding: '10px 20px',
            borderRadius: 24,
            whiteSpace: 'pre-wrap',
            textAlign: 'center',
            maxWidth: 300,
            border: '1px solid rgb(var(--border-rgb))',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        >
          {shareToast}
        </div>
      )}

      {/* ── 共有ボトムシート ── */}
      <BottomSheet open={showShare} onClose={() => setShowShare(false)}>
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* タイトル */}
          <div style={{ color: 'var(--foreground)', fontWeight: 700, fontSize: 16, marginBottom: 20, textAlign: 'center' }}>
            シェア
          </div>

          {/* 共有先リスト */}
          {SHARE_ITEMS.map(item => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                width: '100%',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid rgb(var(--border-rgb))',
                color: 'var(--foreground)',
                fontSize: 15,
                padding: '16px 4px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20, width: 28 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* キャンセル */}
          <button
            onClick={() => setShowShare(false)}
            style={{
              marginTop: 12,
              width: '100%',
              background: 'var(--surface)',
              border: 'none',
              borderRadius: 12,
              color: 'var(--muted)',
              fontSize: 15,
              padding: '14px',
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
        </div>
      </BottomSheet>
    </article>
  );
}
