'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SyncLogo from '@/components/SyncLogo';
import PostCard from '@/components/PostCard';
import HashtagFilterBar from '@/components/HashtagFilterBar';
import {
  CONVERSATIONS, TIMELINE_POSTS, FRIENDS_POSTS,
  FOLLOWED_HASHTAGS, CURRENT_USER, getTagEngagement, type Post,
} from '@/lib/mockData';
import { RAINBOW } from '@/lib/rainbow';

// ── 時間帯バブルカラー ───────────────────────────────────────────
function getBubbleColors(): string[] {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10)  return ['rgba(255,220,180,0.7)', 'rgba(255,200,150,0.6)', 'rgba(200,230,255,0.7)'];
  if (hour >= 10 && hour < 17) return ['rgba(180,220,255,0.7)', 'rgba(200,240,255,0.6)', 'rgba(255,255,255,0.8)'];
  if (hour >= 17 && hour < 20) return ['rgba(255,160,100,0.7)', 'rgba(255,120,150,0.6)', 'rgba(255,200,100,0.7)'];
  return ['rgba(150,100,255,0.7)', 'rgba(100,150,255,0.6)', 'rgba(200,100,255,0.7)'];
}

function spawnSoapBubbles(container: HTMLElement): void {
  if (typeof window === 'undefined') return;
  container.querySelectorAll('.soap-bubble').forEach((el) => el.remove());
  const colors = getBubbleColors();
  Array.from({ length: 7 }, (_, i) => {
    const el = document.createElement('div');
    el.className = 'soap-bubble';
    const size  = 10 + Math.random() * 20;
    const delay = Math.random() * 400;
    const x     = container.offsetWidth * 0.5 + (Math.random() - 0.5) * 120;
    el.style.width             = `${size}px`;
    el.style.height            = `${size}px`;
    el.style.left              = `${x}px`;
    el.style.top               = '150px';
    el.style.background        = colors[i % colors.length];
    el.style.animationDelay    = `${delay}ms`;
    el.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
    container.appendChild(el);
    setTimeout(() => el.parentNode?.removeChild(el), 3000);
  });
}

function spawnSheetBubbles(container: HTMLElement): void {
  if (typeof window === 'undefined') return;
  const hour = new Date().getHours();
  const colors =
    hour >= 5  && hour < 10 ? ['rgba(255,180,100,0.9)', 'rgba(255,150,80,0.8)',  'rgba(255,200,120,0.9)'] :
    hour >= 10 && hour < 17 ? ['rgba(100,180,255,0.9)', 'rgba(80,200,255,0.8)',  'rgba(150,220,255,0.9)'] :
    hour >= 17 && hour < 20 ? ['rgba(255,100,100,0.9)', 'rgba(255,120,80,0.8)',  'rgba(255,80,150,0.9)']  :
                               ['rgba(150,80,255,0.9)',  'rgba(100,120,255,0.8)', 'rgba(180,80,255,0.9)'];
  const w = container.offsetWidth;
  const h = container.offsetHeight;
  if (w <= 0 || h <= 0) return;
  const count = 60 + Math.floor(Math.random() * 21);
  Array.from({ length: count }, (_, i) => {
    const el    = document.createElement('div');
    el.className = 'tiny-bubble';
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
    el.style.setProperty('--tx', `${tx}px`);
    el.style.setProperty('--ty', `${ty}px`);
    el.style.animationName           = 'bubbleBlast';
    el.style.animationDuration       = `${dur}s`;
    el.style.animationDelay          = `${delay}ms`;
    el.style.animationFillMode       = 'forwards';
    el.style.animationTimingFunction = 'ease-out';
    container.appendChild(el);
    setTimeout(() => el.parentNode?.removeChild(el), 3000);
  });
}

const TABS = ['Timeline', 'Friends'] as const;
type Tab = typeof TABS[number];

const hasUnread = CONVERSATIONS.some((c) => c.unread);
const DM_UNREAD = CONVERSATIONS.filter((c) => c.unread).length;
const NOTIF_UNREAD = 3;

// ── サイドドロワーメニュー ─────────────────────────────────────────
const DRAWER_ITEMS = [
  { icon: '👤', label: 'プロフィール',      path: '/profile'  as string | null },
  { icon: '🕐', label: '履歴',              path: '/history' },
  { icon: '💳', label: '支払い',            path: '/payment' },
  { icon: '📱', label: 'QRコード',          path: '/qrcode' },
  { icon: '⚙️', label: '設定とプライバシー', path: '/settings' },
];

// ── 左スライドインサイドドロワー ──────────────────────────────────

function SideDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [showLogoutDlg, setShowLogoutDlg] = useState(false);

  function navigate(path: string) {
    onClose();
    setTimeout(() => router.push(path), 240);
  }

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 z-40"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.28s ease',
        }}
        onClick={onClose}
      />

      {/* ドロワー本体 */}
      <div
        className="absolute top-0 left-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: '80%',
          maxWidth: 300,
          background: '#000',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          boxShadow: open ? '8px 0 40px rgba(0,0,0,0.7)' : 'none',
        }}
      >
        {/* ユーザー情報 */}
        <div style={{ padding: '52px 20px 16px' }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, marginBottom: 14,
              background: 'rgba(255,255,255,0.12)',
              border: '2px solid rgba(255,255,255,0.25)',
            }}
          >
            {CURRENT_USER.avatar}
          </div>
          <p style={{ fontWeight: 700, color: '#fff', fontSize: 16, lineHeight: 1.3, margin: 0 }}>
            {CURRENT_USER.name}
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
            {CURRENT_USER.handle}
          </p>
          {/* フォロー数表示なし */}
        </div>

        {/* 区切り */}
        <div style={{ height: 1, margin: '0 20px 4px', background: 'rgba(255,255,255,0.1)' }} />

        {/* メニュー */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {DRAWER_ITEMS.map(({ icon, label, path }) => (
            <button
              key={label}
              onClick={() => path ? navigate(path) : onClose()}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                width: '100%', padding: '14px 20px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1, fontWeight: 600, color: '#fff', fontSize: 15 }}>{label}</span>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2}
                style={{ width: 16, height: 16, stroke: 'rgba(255,255,255,0.25)', flexShrink: 0 }}
              >
                <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>

        {/* 区切り */}
        <div style={{ height: 1, margin: '0 20px', background: 'rgba(255,255,255,0.1)' }} />

        {/* ログアウト */}
        <button
          onClick={() => setShowLogoutDlg(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 16,
            width: '100%', padding: '16px 20px',
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>🚪</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#FF453A' }}>ログアウト</span>
        </button>

        {/* ログアウト確認ダイアログ */}
        {showLogoutDlg && (
          <>
            <div
              className="absolute inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setShowLogoutDlg(false)}
            />
            <div
              className="absolute left-1/2 z-50 flex flex-col"
              style={{
                top: '50%', transform: 'translate(-50%,-50%)',
                width: 280,
                background: 'var(--surface)',
                borderRadius: 18,
                overflow: 'hidden',
                border: '1px solid var(--surface-2)',
              }}
            >
              <div className="px-6 pt-6 pb-4 text-center">
                <p className="text-base font-bold mb-1" style={{ color: 'var(--foreground)' }}>ログアウト</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>本当にログアウトしますか？</p>
              </div>
              <div style={{ borderTop: '1px solid var(--surface-2)' }}>
                <button
                  onClick={() => setShowLogoutDlg(false)}
                  className="w-full py-3.5 text-sm font-semibold"
                  style={{ borderBottom: '1px solid var(--surface-2)', color: 'var(--muted)', background: 'transparent' }}
                >
                  キャンセル
                </button>
                <button
                  onClick={() => { setShowLogoutDlg(false); onClose(); }}
                  className="w-full py-3.5 text-sm font-bold"
                  style={{ color: '#FF453A', background: 'transparent' }}
                >
                  ログアウト
                </button>
              </div>
            </div>
          </>
        )}

        {/* ロゴ */}
        <div style={{ padding: '0 20px 32px' }}>
          <span style={{
            fontSize: 12, fontWeight: 900, letterSpacing: '-0.02em',
            backgroundImage: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            SYNC.
          </span>
        </div>
      </div>
    </>
  );
}

// ── 投稿モーダル ──────────────────────────────────────────────────

type MediaItem = { url: string; type: 'image' | 'video' };

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u3040-\u9fff]+/g);
  return matches ?? [];
}

async function scanWithAI(text: string): Promise<{ blocked: boolean; reason: string }> {
  console.log('[scanWithAI] スキャン開始:', text);
  const res = await fetch('/api/scan-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  console.log('[scanWithAI] レスポンス:', data);
  return data;
}

function PostModal({ open, onClose, onPost }: { open: boolean; onClose: () => void; onPost: (post: Post) => void }) {
  const [text,       setText]       = useState('');
  const [posted,     setPosted]     = useState(false);
  const [media,      setMedia]      = useState<MediaItem | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showOpps,   setShowOpps]   = useState(false);
  const [oppsMessage, setOppsMessage] = useState('');
  const imageRef  = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textaRef  = useRef<HTMLTextAreaElement>(null);
  const modalRef  = useRef<HTMLDivElement>(null);

  const MAX_CHARS  = 280;
  const used       = text.length;
  const remaining  = MAX_CHARS - used;
  const canPost    = text.trim().length > 0 || media !== null;
  const R          = 9;
  const CIRC       = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - Math.min(used / MAX_CHARS, 1));

  useEffect(() => {
    if (open) {
      if (modalRef.current) spawnSheetBubbles(modalRef.current);
      setTimeout(() => textaRef.current?.focus(), 120);
    } else {
      if (media) { URL.revokeObjectURL(media.url); setMedia(null); }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (media) URL.revokeObjectURL(media.url);
    setMedia({ url: URL.createObjectURL(file), type: file.type.startsWith('video') ? 'video' : 'image' });
  }
  function removeMedia() {
    if (media) URL.revokeObjectURL(media.url);
    setMedia(null);
  }
  function handleClose() { removeMedia(); setText(''); onClose(); }
  function doPost() {
    const now      = Date.now();
    const lifetime = 72 * 60 * 60 * 1000;
    const newPost: Post = {
      id:        `post_${now}`,
      avatar:    CURRENT_USER.avatar,
      handle:    CURRENT_USER.handle,
      name:      CURRENT_USER.name,
      content:   text,
      hashtags:  extractHashtags(text),
      time:      'たった今',
      createdAt: now,
      expiresAt: now + lifetime,
      isMutual:  true,
    };
    onPost(newPost);
    if (modalRef.current) spawnSoapBubbles(modalRef.current);
    setPosted(true);
    setTimeout(() => { setPosted(false); removeMedia(); setText(''); onClose(); }, 1000);
  }

  async function handlePost() {
    if (!canPost) return;

    setIsScanning(true);
    try {
      const result = await scanWithAI(text);
      if (result.blocked) {
        setIsScanning(false);
        setOppsMessage(result.reason);
        setShowOpps(true);
        return;
      }
    } catch {
      // エラー時は投稿を通す
    }
    setIsScanning(false);
    doPost();
  }

  return (
    <>
    {/* Opps! モーダル */}
    {showOpps && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
      }}>
        <div style={{
          background: '#1a1a2e',
          border: '2px solid #FF1A1A',
          borderRadius: 20,
          padding: '32px 24px',
          textAlign: 'center',
          maxWidth: 300,
          width: '80%',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#FF1A1A', marginBottom: 8 }}>
            Opps!
          </div>
          <div style={{ color: '#fff', fontSize: 14, marginBottom: 24 }}>
            {oppsMessage}
          </div>
          <button
            onClick={() => setShowOpps(false)}
            style={{
              background: '#FF1A1A', color: '#fff',
              border: 'none', borderRadius: 12,
              padding: '10px 32px', fontWeight: 'bold',
              fontSize: 16, cursor: 'pointer',
            }}
          >
            見直す
          </button>
        </div>
      </div>
    )}

    <div
      ref={modalRef}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        background: '#111111',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: open ? 'transform 0.25s ease-out' : 'transform 0.26s ease-in',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* ── ヘッダー ── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px', background: '#111111',
      }}>
        <button style={{ color: '#ffffff', fontSize: 15, fontWeight: 500, padding: '0 4px' }} onClick={handleClose}>
          キャンセル
        </button>
        <div />
        <button
          disabled={isScanning || !canPost}
          style={{
            paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6,
            borderRadius: 9999, fontSize: 14, fontWeight: 700, color: '#ffffff',
            background: isScanning ? '#999' : canPost ? '#E63946' : '#ddd',
            transition: 'background 0.2s',
            cursor: isScanning ? 'not-allowed' : 'pointer',
          }}
          onClick={handlePost}
        >
          {posted ? '投稿しました！' : isScanning ? 'スキャン中...' : '投稿'}
        </button>
      </div>

      {/* ── 入力エリア ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 12, padding: '4px 16px 0' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0, marginTop: 2,
          background: 'var(--surface-2)',
        }}>
          {CURRENT_USER.avatar}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
          <textarea
            ref={textaRef}
            rows={4}
            style={{
              width: '100%', resize: 'none', outline: 'none',
              background: 'transparent', color: '#ffffff',
              fontSize: 19, lineHeight: 1.6, caretColor: '#FF1A1A',
              border: 'none', fontFamily: 'inherit',
            }}
            placeholder="今何してる？"
            maxLength={MAX_CHARS}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <style>{`textarea::-webkit-input-placeholder{color:#666;}textarea::placeholder{color:#666;}`}</style>
          {media && (
            <div style={{ position: 'relative', marginTop: 12, borderRadius: 16, overflow: 'hidden', border: '1px solid #333' }}>
              {media.type === 'image' ? (
                <img src={media.url} alt="preview" style={{ width: '100%', objectFit: 'cover', maxHeight: 280, display: 'block' }} />
              ) : (
                <video src={media.url} controls style={{ width: '100%', maxHeight: 280, display: 'block' }} />
              )}
              <button
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer',
                }}
                onClick={removeMedia}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} style={{ width: 14, height: 14 }}>
                  <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 下部ツールバー ── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '8px 8px', paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)',
        borderTop: '1px solid #333', background: '#111111',
      }}>
        <button
          style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer' }}
          onClick={() => imageRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={1.8} style={{ width: 20, height: 20 }}>
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="#ffffff" />
            <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
          </svg>
        </button>
        <input ref={imageRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])} />

        <button
          style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer' }}
          onClick={() => cameraRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={1.8} style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])} />

        <button style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
          #
        </button>
        <button style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={1.8} style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 }}>
          {remaining <= 20 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: remaining < 0 ? '#E63946' : '#999', fontVariantNumeric: 'tabular-nums' }}>
              {remaining}
            </span>
          )}
          <svg width="26" height="26" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="12" cy="12" r={R} fill="none" stroke="#333" strokeWidth="2.4" />
            <circle cx="12" cy="12" r={R} fill="none" stroke="#E63946" strokeWidth="2.4"
              strokeDasharray={CIRC} strokeDashoffset={dashOffset}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.15s' }}
            />
          </svg>
        </div>
      </div>
    </div>
    </>
  );
}

// ── 返信モーダル（フルスクリーン・下からスライドアップ） ──────────

function ReplyModal({
  post,
  open,
  onClose,
}: {
  post: Post | null;
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const textaRef  = useRef<HTMLTextAreaElement>(null);
  const modalRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && modalRef.current) spawnSheetBubbles(modalRef.current);
    if (open) setTimeout(() => textaRef.current?.focus(), 120);
  }, [open]);

  // キープ: アニメーション中も最後の投稿を表示
  const lastPost = useRef<Post | null>(null);
  if (post) lastPost.current = post;
  const displayPost = post ?? lastPost.current;

  function handlePost() {
    if (!text.trim()) return;
    setText('');
    onClose();
  }

  return (
    <div
      ref={modalRef}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        background: 'var(--background)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: open ? 'transform 0.25s ease-out' : 'transform 0.28s ease-in',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* ── ヘッダー ── */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        <button
          className="text-sm font-medium active:opacity-60 transition-opacity"
          style={{ color: 'var(--foreground)' }}
          onClick={() => { setText(''); onClose(); }}
        >
          キャンセル
        </button>
        <button
          onClick={handlePost}
          disabled={!text.trim()}
          className="px-5 py-1.5 rounded-full text-sm font-bold transition-colors"
          style={{
            background: text.trim() ? 'var(--brand)' : 'rgba(255,26,26,0.25)',
            color: text.trim() ? '#ffffff' : 'rgba(255,26,26,0.5)',
          }}
        >
          返信
        </button>
      </div>

      {/* ── 本文エリア ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {displayPost && (
          <>
            {/* 元投稿 */}
            <div className="flex gap-3 mb-0">
              {/* 左: アバター + スレッド線 */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}
                >
                  {displayPost.avatar}
                </div>
                <div
                  className="flex-1 rounded-full mt-1.5"
                  style={{ width: 2, minHeight: 28, background: 'var(--surface-2)' }}
                />
              </div>
              {/* 右: 投稿内容 */}
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                    {displayPost.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {displayPost.handle}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {displayPost.content}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {displayPost.hashtags.map((tag) => (
                    <span key={tag} className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* リプライ入力行 */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}
                >
                  {CURRENT_USER.avatar}
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-2">
                <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                  Replying to{' '}
                  <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{displayPost.handle}</span>
                </p>
                <textarea
                  ref={textaRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="返信を投稿"
                  rows={4}
                  className="w-full resize-none outline-none text-sm leading-relaxed"
                  style={{
                    background: 'transparent',
                    color: 'var(--foreground)',
                    caretColor: 'var(--brand)',
                    border: 'none',
                    fontFamily: 'inherit',
                    overflow: 'hidden',
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メインページ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function HomePage() {
  const router = useRouter();
  const [activeTab,     setActiveTab]     = useState<Tab>('Timeline');
  const [timelineFilter, setTimelineFilter] = useState<string[]>([]);
  const [friendsFilter,  setFriendsFilter]  = useState<string[]>([]);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [replyPost,     setReplyPost]     = useState<Post | null>(null);
  const [replyOpen,     setReplyOpen]     = useState(false);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [feedPosts,     setFeedPosts]     = useState<Post[]>(TIMELINE_POSTS);
  const [cardColor,     setCardColor]     = useState<string>('');
  const [hashtagColor,  setHashtagColor]  = useState<string>('');
  const [toastMsg,      setToastMsg]      = useState<string | null>(null);

  useEffect(() => {
    const bg = localStorage.getItem('sync_card_bg');
    const legacy = localStorage.getItem('sync_card_color');
    const stored = bg !== null ? bg : legacy;
    if (stored !== null) setCardColor(stored);
    const htc = localStorage.getItem('sync_hashtag_color');
    if (htc) setHashtagColor(htc);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sync_card_bg') setCardColor(e.newValue ?? '');
      else if (e.key === 'sync_card_color' && localStorage.getItem('sync_card_bg') === null) setCardColor(e.newValue ?? '');
      else if (e.key === 'sync_hashtag_color') setHashtagColor(e.newValue ?? '');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFeedPosts(prev => prev.filter(p => p.expiresAt > Date.now()));
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const timelinePosts = useMemo(() => {
    const now   = Date.now();
    const alive = feedPosts.filter(p => p.expiresAt > now);
    if (timelineFilter.length === 0) return alive;
    return alive.filter((p) =>
      p.hashtags.some((tag) => timelineFilter.includes(tag)),
    );
  }, [feedPosts, timelineFilter]);

  const friendsPosts = useMemo(() => {
    if (friendsFilter.length === 0) return FRIENDS_POSTS;
    return FRIENDS_POSTS.filter((p) =>
      p.hashtags.some((tag) => friendsFilter.includes(tag)),
    );
  }, [friendsFilter]);

  const friendsTags = useMemo(() => {
    const set = new Set<string>();
    FRIENDS_POSTS.forEach((p) => p.hashtags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, []);

  function isTagEngaged(tag: string): boolean {
    const tagName = tag.replace('#', '');
    return getTagEngagement(tagName).unlocked;
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function openReply(post: Post) {
    if (post.hashtags.length > 0 && !post.hashtags.some(isTagEngaged)) {
      const tag = post.hashtags[0];
      showToast(`${tag}のエンゲージメントを達成するとコメントできます`);
      return;
    }
    setReplyPost(post);
    setReplyOpen(true);
  }

  function handleHashtagClick(tag: string) {
    router.push(`/search?tag=${tag.replace('#', '')}`);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── トースト ────────────────────────────────────────────────── */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(30,30,30,0.95)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            padding: '10px 18px',
            borderRadius: 24,
            maxWidth: 320,
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* ── サイドドロワー ─────────────────────────────────────────── */}
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── 返信モーダル ───────────────────────────────────────────── */}
      <ReplyModal
        post={replyPost}
        open={replyOpen}
        onClose={() => setReplyOpen(false)}
      />

      {/* ── 投稿モーダル ───────────────────────────────────────────── */}
      <PostModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPost={(post) => setFeedPosts(prev => [post, ...prev])}
      />

      {/* ── ヘッダー ───────────────────────────────────────────────── */}
      <header
        className="px-4 pt-12 pb-3 flex items-center justify-between flex-shrink-0"
        style={{ background: 'var(--background)' }}
      >
        {/* 左: アバター → ドロワー */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0 active:opacity-70 transition-opacity"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--surface-2)',
          }}
        >
          {CURRENT_USER.avatar}
        </button>

        {/* 中央: ロゴ */}
        <SyncLogo width={120} />

        {/* 右: 通知・チャットアイコン */}
        <div className="flex items-center gap-1">
        <Link href="/notifications" className="relative w-8 h-8 flex items-center justify-center">
          <svg
            width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--foreground)' }}
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {NOTIF_UNREAD > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold border-2"
              style={{ background: '#FF1A1A', borderColor: 'var(--background)', color: '#fff' }}
            >
              {NOTIF_UNREAD}
            </span>
          )}
        </Link>
        <Link href="/chat" className="relative w-8 h-8 flex items-center justify-center">
          <svg
            width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--foreground)' }}
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {DM_UNREAD > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold border-2"
              style={{ background: '#FF1A1A', borderColor: 'var(--background)', color: '#fff' }}
            >
              {DM_UNREAD}
            </span>
          )}
        </Link>
        </div>
      </header>

      {/* ── タブバー ───────────────────────────────────────────────── */}
      <div
        className="flex border-b px-5 flex-shrink-0"
        style={{ borderColor: 'var(--surface-2)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="mr-6 py-3 text-sm font-medium relative transition-colors duration-200"
            style={activeTab === tab
              ? { background: RAINBOW, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
              : { color: 'var(--muted)' }}
          >
            {tab}
            {activeTab === tab && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: RAINBOW }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── 投稿FABボタン ─────────────────────────────────────────── */}
      <button
        className="absolute z-40 flex items-center justify-center rounded-full active:scale-90 transition-all"
        style={{
          bottom: 88, right: 16,
          width: 56, height: 56,
          background: RAINBOW,
          boxShadow: '0 4px 20px rgba(124,111,232,0.5)',
        }}
        onClick={() => setModalOpen(true)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 20 20" width="31" height="31" fill="none">
          <g transform="rotate(45, 12, 12)">
            <rect x="10.5" y="12" width="3" height="6" rx="1.5" fill="white" opacity="0.9"/>
            <path d="M10.5 18 L12 22 L13.5 18 Z" fill="white" opacity="0.9"/>
            <rect x="10" y="11.5" width="4" height="1" rx="0.5" fill="white" opacity="0.7"/>
            <circle cx="12" cy="9" r="2.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.9"/>
            <circle cx="12" cy="9" r="2.5" fill="white" opacity="0.25"/>
            <circle cx="8.5" cy="7.5" r="1.8" fill="none" stroke="white" strokeWidth="0.7" opacity="0.8"/>
            <circle cx="8.5" cy="7.5" r="1.8" fill="white" opacity="0.2"/>
            <circle cx="15.5" cy="7" r="1.6" fill="none" stroke="white" strokeWidth="0.7" opacity="0.8"/>
            <circle cx="15.5" cy="7" r="1.6" fill="white" opacity="0.2"/>
            <circle cx="7" cy="5" r="1.1" fill="none" stroke="white" strokeWidth="0.6" opacity="0.7"/>
            <circle cx="7" cy="5" r="1.1" fill="white" opacity="0.15"/>
            <circle cx="16.5" cy="4.5" r="1" fill="none" stroke="white" strokeWidth="0.6" opacity="0.7"/>
            <circle cx="10" cy="4" r="0.6" fill="white" opacity="0.6"/>
            <circle cx="14" cy="3.5" r="0.5" fill="white" opacity="0.5"/>
            <circle cx="9" cy="3" r="0.4" fill="white" opacity="0.4"/>
            <circle cx="17" cy="6" r="0.5" fill="white" opacity="0.5"/>
          </g>
        </svg>
      </button>

      {/* ── コンテンツ ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'Timeline' && (
          <>
            <HashtagFilterBar
              tags={FOLLOWED_HASHTAGS}
              selected={timelineFilter}
              onChange={setTimelineFilter}
            />
            <div key={`tl-${timelineFilter.join(',')}`} className="feed-animate">
              {timelinePosts.length > 0 ? (
                timelinePosts.map((post) => (
                  <PostCard key={post.id} post={post} onReply={openReply} onHashtagClick={handleHashtagClick} onUserClick={() => { const u = post.handle.replace('@', ''); router.push(u === 'you' ? '/profile' : `/profile/${u}`); }} cardColor={cardColor || undefined} hashtagBorderColor={hashtagColor || undefined} isReplyLocked={post.hashtags.length > 0 && !post.hashtags.some(isTagEngaged)} />
                ))
              ) : (
                <EmptyState message="No posts for the selected tags" />
              )}
            </div>
          </>
        )}

        {activeTab === 'Friends' && (
          <div key="friends" className="feed-animate">
            <HashtagFilterBar
              tags={friendsTags}
              selected={friendsFilter}
              onChange={setFriendsFilter}
            />
            <div key={`fr-${friendsFilter.join(',')}`} className="feed-animate">
              {friendsPosts.length > 0 ? (
                friendsPosts.map((post) => (
                  <PostCard key={post.id} post={post} onReply={openReply} onHashtagClick={handleHashtagClick} onUserClick={() => { const u = post.handle.replace('@', ''); router.push(u === 'you' ? '/profile' : `/profile/${u}`); }} cardColor={cardColor || undefined} hashtagBorderColor={hashtagColor || undefined} isReplyLocked={post.hashtags.length > 0 && !post.hashtags.some(isTagEngaged)} />
                ))
              ) : (
                <EmptyState message="No posts for the selected tags" />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>{message}</p>
    </div>
  );
}
