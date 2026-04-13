'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import SyncLogo from '@/components/SyncLogo';
import { useAuth } from '@/contexts/AuthContext';
import PostCard from '@/components/PostCard';
import HashtagFilterBar from '@/components/HashtagFilterBar';
import type { Post } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
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

// DM未読バッジ: チャットテーブル連携後に復活させる
const hasUnread = false;
const DM_UNREAD = 0;

// ── サイドドロワーメニュー ─────────────────────────────────────────
const DRAWER_ITEMS = [
  { icon: '👤', tKey: 'menuProfile',   path: '/profile'  as string | null },
  { icon: '📱', tKey: 'menuQrcode',    path: '/qrcode' },
  { icon: '⚙️', tKey: 'menuSettings',  path: '/settings' },
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
  const t = useTranslations('home');
  const { signOut, profile } = useAuth();
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
          background: 'var(--background)',
          opacity: 1,
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
            {profile?.avatar_url ?? '✨'}
          </div>
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.3, margin: 0 }}>
            {profile?.display_name ?? 'ゲスト'}
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
            {'@' + (profile?.username ?? 'user')}
          </p>
          {/* フォロー数表示なし */}
        </div>

        {/* 区切り */}
        <div style={{ height: 1, margin: '0 20px 4px', background: 'rgba(255,255,255,0.1)' }} />

        {/* メニュー */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {DRAWER_ITEMS.map(({ icon, tKey, path }) => (
            <button
              key={tKey}
              onClick={() => path ? navigate(path) : onClose()}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                width: '100%', padding: '14px 20px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{t(tKey as Parameters<typeof t>[0])}</span>
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
          <span style={{ fontWeight: 600, fontSize: 15, color: '#FF453A' }}>{t('logout')}</span>
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
                <p className="text-base font-bold mb-1" style={{ color: 'var(--foreground)' }}>{t('logout')}</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('logoutConfirm')}</p>
              </div>
              <div style={{ borderTop: '1px solid var(--surface-2)' }}>
                <button
                  onClick={() => setShowLogoutDlg(false)}
                  className="w-full py-3.5 text-sm font-semibold"
                  style={{ borderBottom: '1px solid var(--surface-2)', color: 'var(--muted)', background: 'transparent' }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={async () => { setShowLogoutDlg(false); onClose(); await signOut(); router.push('/auth'); }}
                  className="w-full py-3.5 text-sm font-bold"
                  style={{ color: '#FF453A', background: 'transparent' }}
                >
                  {t('logout')}
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

function highlightHashtags(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  return escaped.replace(
    /#([\w\u3040-\u9fff]+)/g,
    '<span style="color:#f472b6;font-weight:600">#$1</span>'
  );
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
  const t = useTranslations('home');
  const { user, profile } = useAuth();
  const [text,         setText]         = useState('');
  const [posted,       setPosted]       = useState(false);
  const [media,        setMedia]        = useState<MediaItem | null>(null);
  const [isScanning,   setIsScanning]   = useState(false);
  const [showOpps,     setShowOpps]     = useState(false);
  const [oppsMessage,  setOppsMessage]  = useState('');
  const [followedTags, setFollowedTags] = useState<string[]>([]);
  const [suggestions,  setSuggestions]  = useState<string[]>([]);
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
      // フォロー中ハッシュタグを取得
      if (user && followedTags.length === 0) {
        supabase
          .from('follows')
          .select('tag')
          .eq('follower_id', user.id)
          .eq('type', 'hashtag')
          .then(({ data }) => {
            if (data) {
              setFollowedTags(
                (data as { tag: string | null }[]).map((r) => r.tag).filter(Boolean) as string[]
              );
            }
          });
      }
    } else {
      if (media) { URL.revokeObjectURL(media.url); setMedia(null); }
      setSuggestions([]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function getHashQuery(value: string, cursorPos: number): string | null {
    const before = value.slice(0, cursorPos);
    const match = before.match(/#(\w*)$/);
    return match ? match[1] : null;
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const query = getHashQuery(val, cursor);
    if (query !== null) {
      const prefix = '#' + query;
      const filtered = followedTags.filter((tag) =>
        tag.toLowerCase().startsWith(prefix.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }

  function applySuggestion(tag: string) {
    const el = textaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after  = text.slice(cursor);
    const newBefore = before.replace(/#\w*$/, tag + ' ');
    const newText = newBefore + after;
    setText(newText);
    setSuggestions([]);
    // カーソルを挿入位置の後ろに移動
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newBefore.length, newBefore.length);
    }, 0);
  }

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
  async function doPost() {
    if (!user) return;
    const hashtags  = extractHashtags(text);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    // profiles から lat/lng を取得して投稿にコピー
    const { data: profileGps } = await (supabase as any)
      .from('profiles')
      .select('lat, lng')
      .eq('id', user.id)
      .single();

    const { data, error } = await (supabase as any)
      .from('posts')
      .insert({
        user_id:    user.id,
        content:    text,
        hashtags,
        is_mutual:  false,
        expires_at: expiresAt,
        lat:        profileGps?.lat ?? null,
        lng:        profileGps?.lng ?? null,
      } as any)
      .select(`
        id, content, hashtags, is_mutual, expires_at, created_at, lat, lng,
        profiles (id, username, display_name, avatar_url)
      `)
      .single();

    if (!error && data) {
      const d = data as any;
      const prof = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
      const newPost: Post = {
        id:        d.id,
        content:   d.content,
        hashtags:  (d.hashtags as string[]) ?? [],
        time:      '',
        isMutual:  d.is_mutual,
        expiresAt: new Date(d.expires_at).getTime(),
        createdAt: new Date(d.created_at).getTime(),
        name:      (prof as { display_name?: string } | null)?.display_name ?? profile?.display_name ?? 'Unknown',
        handle:    '@' + ((prof as { username?: string } | null)?.username ?? profile?.username ?? 'user'),
        avatar:    (prof as { avatar_url?: string | null } | null)?.avatar_url ?? profile?.avatar_url ?? '✨',
        lat:       d.lat ?? null,
        lng:       d.lng ?? null,
      };
      onPost(newPost);
      // 投稿したハッシュタグのエンゲージメントを+1
      for (const tag of hashtags) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.rpc as any)('increment_hashtag_post', { p_user_id: user.id, p_tag: tag });
      }
      if (modalRef.current) spawnSoapBubbles(modalRef.current);
      setPosted(true);
      setTimeout(() => { setPosted(false); removeMedia(); setText(''); onClose(); }, 1000);
    } else {
      console.error('投稿エラー:', error);
    }
  }

  async function handlePost() {
    if (!canPost) return;

    setIsScanning(true);
    try {
      const result = await scanWithAI(text);
      if (result.blocked) {
        if (user) {
          await (supabase as any).from('oops_logs').insert({
            user_id: user.id,
            content: text,
            reason:  result.reason,
          });
        }
        setIsScanning(false);
        setOppsMessage(result.reason);
        setShowOpps(true);
        return;
      }
    } catch {
      // エラー時は投稿を通す
    }
    setIsScanning(false);
    await doPost();
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
            {t('review')}
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
          {t('cancel')}
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
          {posted ? t('posted') : isScanning ? t('scanning') : t('post')}
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
          {profile?.avatar_url ?? '✨'}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            {/* 装飾レイヤー（背面）: #タグをピンクにハイライト */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0,
                pointerEvents: 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                color: '#ffffff',
                fontSize: 19, lineHeight: 1.6,
                fontFamily: 'inherit',
                padding: 0,
                margin: 0,
              }}
              dangerouslySetInnerHTML={{ __html: highlightHashtags(text) || '<span style="opacity:0">x</span>' }}
            />
            {/* 入力レイヤー（前面・透明） */}
            <textarea
              ref={textaRef}
              rows={4}
              style={{
                position: 'relative',
                width: '100%', resize: 'none', outline: 'none',
                background: 'transparent', color: 'transparent',
                caretColor: '#FF1A1A',
                fontSize: 19, lineHeight: 1.6,
                border: 'none', fontFamily: 'inherit',
                padding: 0, margin: 0,
              }}
              placeholder={t('postPlaceholder')}
              maxLength={MAX_CHARS}
              value={text}
              onChange={handleTextChange}
            />
          </div>
          {suggestions.length > 0 && (
            <div style={{
              background: '#111',
              border: '1px solid #333',
              borderRadius: 12,
              overflow: 'hidden',
              marginTop: 4
            }}>
              {suggestions.map(tag => (
                <button
                  key={tag}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    applySuggestion(tag)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid #222',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ color: '#E63946', fontWeight: 700, fontSize: 13 }}>#</span>
                  <span style={{ color: '#fff', fontSize: 13 }}>
                    {tag.replace(/^#/, '')}
                  </span>
                </button>
              ))}
            </div>
          )}
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

// ── 返信アイテム型 ────────────────────────────────────────────────
type ReplyItem = {
  id:         string;
  content:    string;
  created_at: string;
  profile: {
    username:     string;
    display_name: string;
    avatar_url:   string | null;
  } | null;
};

function ReplyModal({
  post,
  open,
  onClose,
  onReplied,
}: {
  post:       Post | null;
  open:       boolean;
  onClose:    () => void;
  onReplied?: () => void;
}) {
  const t = useTranslations('home');
  const { user, profile } = useAuth();
  const [text,        setText]        = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [replies,     setReplies]     = useState<ReplyItem[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const textaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const hashtagColor = typeof window !== 'undefined' ? localStorage.getItem('sync_hashtag_color') || '' : '';

  useEffect(() => {
    if (open && modalRef.current) spawnSheetBubbles(modalRef.current);
    if (open) setTimeout(() => textaRef.current?.focus(), 120);
  }, [open]);

  // キープ: アニメーション中も最後の投稿を表示
  const lastPost = useRef<Post | null>(null);
  if (post) lastPost.current = post;
  const displayPost = post ?? lastPost.current;

  // 既存の返信を取得
  useEffect(() => {
    if (!open || !displayPost) return;
    setRepliesLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('posts') as any)
      .select(`
        id, content, created_at,
        profile:profiles!posts_user_id_fkey (
          username, display_name, avatar_url
        )
      `)
      .eq('parent_id', displayPost.id)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: ReplyItem[] | null }) => {
        setReplies(data ?? []);
        setRepliesLoading(false);
      });
  // displayPost.id が変わった（別投稿を開いた）時だけ再取得
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, displayPost?.id]);

  async function handlePost() {
    if (!text.trim() || !user || !displayPost || submitting) return;
    setSubmitting(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('posts') as any).insert({
      user_id:    user.id,
      content:    text.trim(),
      parent_id:  displayPost.id,
      hashtags:   [],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) {
      console.error('返信保存エラー:', error);
    } else {
      setText('');
      onClose();
      onReplied?.();
    }
    setSubmitting(false);
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
          {t('cancel')}
        </button>
        <button
          onClick={handlePost}
          disabled={!text.trim() || submitting}
          className="px-5 py-1.5 rounded-full text-sm font-bold transition-colors"
          style={{
            background: text.trim() && !submitting ? 'var(--brand)' : 'rgba(255,26,26,0.25)',
            color: text.trim() && !submitting ? '#ffffff' : 'rgba(255,26,26,0.5)',
          }}
        >
          {submitting ? '送信中…' : t('reply')}
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
                    <span key={tag} style={hashtagColor ? {
                      background: 'transparent',
                      border: `1.5px solid ${hashtagColor}`,
                      color: '#ffffff',
                      padding: '2px 10px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-block',
                    } : {
                      background: 'linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(90deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF,#9B59B6) border-box',
                      border: '1.5px solid transparent',
                      color: '#ffffff',
                      padding: '2px 10px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-block',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 既存の返信一覧 */}
            {repliesLoading ? (
              <p className="text-xs py-3 pl-12" style={{ color: 'var(--muted)' }}>読み込み中…</p>
            ) : replies.length > 0 && (
              <div className="mb-2">
                {replies.map((r) => (
                  <div key={r.id} className="flex gap-3 py-2">
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        {r.profile?.avatar_url ?? '👤'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                          {r.profile?.display_name ?? ''}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                          @{r.profile?.username ?? ''}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {r.content}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="my-2" style={{ borderTop: '1px solid var(--surface-2)' }} />
              </div>
            )}

            {/* リプライ入力行 */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}
                >
                  {profile?.avatar_url ?? '✨'}
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
                  placeholder={t('replyPlaceholder')}
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
  const t = useTranslations('home');
  const router = useRouter();
  const { user, profile, loading, hasProfile, profileLoading, followedHashtags, followHashtag } = useAuth();
  const [activeTab,     setActiveTab]     = useState<Tab>('Timeline');
  const [timelineFilter, setTimelineFilter] = useState<string[]>([]);
  const [friendsFilter,  setFriendsFilter]  = useState<string[]>([]);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [replyPost,     setReplyPost]     = useState<Post | null>(null);
  const [replyOpen,     setReplyOpen]     = useState(false);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [feedPosts,     setFeedPosts]     = useState<Post[]>([]);
  const [friendsPostsState, setFriendsPostsState] = useState<Post[]>([]);
  const [unlockedTags,     setUnlockedTags]     = useState<string[]>([]);
  const [myReactionsMap,   setMyReactionsMap]   = useState<Record<string, string>>({});
  const [reactionCountsMap, setReactionCountsMap] = useState<Record<string, number>>({});
  const [cardColor,     setCardColor]     = useState<string>('');
  const [hashtagColor,  setHashtagColor]  = useState<string>('');
  const [toastMsg,      setToastMsg]      = useState<string | null>(null);
  const [notifUnread,   setNotifUnread]   = useState(0);

  useEffect(() => {
    if (loading) return;
    if (user && !profileLoading && !hasProfile) { router.push('/auth/username'); }
  }, [loading, user, hasProfile, profileLoading, router]);

  // 未読通知バッジ数
  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ count }) => setNotifUnread(count ?? 0));
  }, [user]);

  // フォロー中ハッシュタグを含む投稿を取得（followedHashtagsが変わるたびに再取得）
  useEffect(() => {
    if (!user || followedHashtags.length === 0) return;
    const fetchPosts = async () => {
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from('posts')
        .select(`
          id, content, hashtags, is_mutual, expires_at, created_at, lat, lng,
          profiles (id, username, display_name, avatar_url)
        `)
        .is('parent_id', null)
        .overlaps('hashtags', followedHashtags)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const mapped: Post[] = data.map((p: any) => {
          const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          return {
            id:        p.id,
            content:   p.content,
            hashtags:  (p.hashtags as string[]) ?? [],
            time:      '',
            isMutual:  p.is_mutual,
            expiresAt: new Date(p.expires_at).getTime(),
            createdAt: new Date(p.created_at).getTime(),
            name:      (prof as { display_name?: string } | null)?.display_name ?? 'Unknown',
            handle:    '@' + ((prof as { username?: string } | null)?.username ?? 'user'),
            avatar:    (prof as { avatar_url?: string | null } | null)?.avatar_url ?? '✨',
            lat:       p.lat ?? null,
            lng:       p.lng ?? null,
          };
        });
        setFeedPosts(mapped);

        // reactions を一括取得してマップに変換
        const postIds = mapped.map(p => p.id);
        if (postIds.length > 0) {
          const { data: allReactions } = await (supabase as any)
            .from('reactions')
            .select('target_id, user_id, emoji')
            .eq('target_type', 'post')
            .in('target_id', postIds);

          const newMyMap: Record<string, string> = {};
          const newCountMap: Record<string, number> = {};
          (allReactions ?? []).forEach((r: any) => {
            if (r.user_id === user.id) newMyMap[r.target_id] = r.emoji;
            newCountMap[r.target_id] = (newCountMap[r.target_id] ?? 0) + 1;
          });
          setMyReactionsMap(prev => ({ ...prev, ...newMyMap }));
          setReactionCountsMap(prev => ({ ...prev, ...newCountMap }));
        }
      }
    };
    fetchPosts();
  }, [user, followedHashtags]);

  // フォロー中ユーザーの投稿を取得
  useEffect(() => {
    if (!user) return;
    const fetchFriendsPosts = async () => {
      const { data: followData } = await (supabase as any)
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('type', 'user')
        .eq('status', 'accepted');

      if (!followData || followData.length === 0) return;

      const followingIds = (followData as any[]).map(f => f.following_id);
      const now = new Date().toISOString();

      const { data: postsData } = await (supabase as any)
        .from('posts')
        .select(`
          id, content, hashtags, is_mutual, expires_at, created_at, lat, lng,
          profiles (id, username, display_name, avatar_url)
        `)
        .is('parent_id', null)
        .in('user_id', followingIds)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsData) {
        const mapped: Post[] = postsData.map((p: any) => {
          const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          return {
            id:        p.id,
            content:   p.content,
            hashtags:  (p.hashtags as string[]) ?? [],
            time:      '',
            isMutual:  p.is_mutual,
            expiresAt: new Date(p.expires_at).getTime(),
            createdAt: new Date(p.created_at).getTime(),
            name:      (prof as { display_name?: string } | null)?.display_name ?? 'Unknown',
            handle:    '@' + ((prof as { username?: string } | null)?.username ?? 'user'),
            avatar:    (prof as { avatar_url?: string | null } | null)?.avatar_url ?? '✨',
            lat:       p.lat ?? null,
            lng:       p.lng ?? null,
          };
        });
        setFriendsPostsState(mapped);

        // フレンド投稿の reactions を一括取得
        const friendPostIds = mapped.map(p => p.id);
        if (friendPostIds.length > 0) {
          const { data: allReactions } = await (supabase as any)
            .from('reactions')
            .select('target_id, user_id, emoji')
            .eq('target_type', 'post')
            .in('target_id', friendPostIds);

          const newMyMap: Record<string, string> = {};
          const newCountMap: Record<string, number> = {};
          (allReactions ?? []).forEach((r: any) => {
            if (r.user_id === user.id) newMyMap[r.target_id] = r.emoji;
            newCountMap[r.target_id] = (newCountMap[r.target_id] ?? 0) + 1;
          });
          setMyReactionsMap(prev => ({ ...prev, ...newMyMap }));
          setReactionCountsMap(prev => ({ ...prev, ...newCountMap }));
        }

        // フレンドの投稿のハッシュタグを自動でエンゲージメント開始
        const allFriendTags = mapped.flatMap(p => p.hashtags);
        const uniqueFriendTags = [...new Set(allFriendTags)];

        const { data: myFollowedTags } = await (supabase as any)
          .from('follows')
          .select('tag')
          .eq('follower_id', user.id)
          .eq('type', 'hashtag');

        const myTags = (myFollowedTags ?? []).map((f: any) => f.tag).filter(Boolean) as string[];
        const newTags = uniqueFriendTags.filter(tag => !myTags.includes(tag));

        for (const tag of newTags) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('hashtag_engagements') as any).upsert(
            { user_id: user.id, tag, post_count: 0, reaction_count: 0 },
            { onConflict: 'user_id,tag', ignoreDuplicates: true },
          );
        }
      }
    };
    fetchFriendsPosts();
  }, [user]);

  // 解放済みハッシュタグを取得（post_count>=3 && reaction_count>=10）
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from('hashtag_engagements')
      .select('tag')
      .eq('user_id', user.id)
      .gte('post_count', 3)
      .gte('reaction_count', 10)
      .then(({ data }: { data: Array<{ tag: string }> | null }) => {
        setUnlockedTags((data ?? []).map(e => e.tag));
      });
  }, [user]);

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
    if (friendsFilter.length === 0) return friendsPostsState;
    return friendsPostsState.filter((p) =>
      p.hashtags.some((tag) => friendsFilter.includes(tag)),
    );
  }, [friendsFilter, friendsPostsState]);

  const friendsTags = useMemo(() => {
    const set = new Set<string>();
    friendsPostsState.forEach((p) => p.hashtags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [friendsPostsState]);

  function isTagEngaged(tag: string): boolean {
    return unlockedTags.includes(tag);
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function openReply(post: Post) {
    if (!user) { showToast('ログインが必要です'); return; }
    if (post.hashtags.length > 0 && !post.hashtags.some(isTagEngaged)) {
      const tag = post.hashtags[0];
      showToast(t('tagLocked', { tag }));
      return;
    }
    setReplyPost(post);
    setReplyOpen(true);
  }

  async function handleReact(postId: string, emoji: string, postHashtags: string[]) {
    if (!user) { showToast('ログインが必要です'); return; }

    // 同じ絵文字で既にリアクション済みなら二重カウントをスキップ
    if (myReactionsMap[postId] === emoji) return;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
    if (!isUUID) {
      console.warn('postId is not a UUID — skipping DB save:', postId);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('reactions') as any).upsert({
      user_id:     user.id,
      target_id:   postId,
      target_type: 'post',
      emoji,
    }, { onConflict: 'user_id,target_id,emoji' });

    if (!error) {
      // ローカル状態を更新
      setMyReactionsMap(prev => ({ ...prev, [postId]: emoji }));
      setReactionCountsMap(prev => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
      // hashtag_engagements.reaction_count を +1
      for (const tag of postHashtags) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rpcErr } = await (supabase.rpc as any)('increment_hashtag_reaction', { p_user_id: user.id, p_tag: tag });
        if (rpcErr) console.error('increment_hashtag_reaction error:', rpcErr);
      }
    } else {
      console.error('reaction upsert error:', error);
    }
  }

  async function handleFollowHashtag(tag: string) {
    if (!user) return;
    if (followedHashtags.includes(tag)) {
      showToast(`${tag} はフォロー済み`);
      return;
    }
    await followHashtag(tag);
    showToast(`${tag} をフォローしました`);
  }

  function handleHashtagClick(tag: string) {
    handleFollowHashtag(tag);
    router.push(`/search?tag=${tag.replace('#', '')}`);
  }

  // セッション確認中はスピナーを表示
  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#7C6FE8', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
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
        onReplied={() => {
          // 返信はフィードに表示されないので feed のリフレッシュは不要
          // 通知はSupabase側トリガーで自動送信済み
        }}
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
          {profile?.avatar_url ?? '✨'}
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
          {notifUnread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold border-2"
              style={{ background: '#FF1A1A', borderColor: 'var(--background)', color: '#fff' }}
            >
              {notifUnread}
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
            {tab === 'Timeline' ? t('timeline') : t('friends')}
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
        onClick={() => user ? setModalOpen(true) : showToast('ログインが必要です')}
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
      <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {activeTab === 'Timeline' && (
          <>
            <HashtagFilterBar
              tags={followedHashtags}
              selected={timelineFilter}
              onChange={setTimelineFilter}
            />
            <div key={`tl-${timelineFilter.join(',')}`} className="feed-animate">
              {timelinePosts.length > 0 ? (
                timelinePosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onReply={openReply}
                    onHashtagClick={handleHashtagClick}
                    onUserClick={() => { const u = post.handle.replace('@', ''); router.push(u === 'you' ? '/profile' : `/profile/${u}`); }}
                    onReact={(emoji) => handleReact(post.id, emoji, post.hashtags)}
                    initialReactedEmoji={myReactionsMap[post.id] ?? null}
                    reactionCount={reactionCountsMap[post.id] ?? 0}
                    cardColor={cardColor || undefined}
                    hashtagBorderColor={hashtagColor || undefined}
                    isReplyLocked={post.hashtags.length > 0 && !post.hashtags.some(isTagEngaged)}
                  />
                ))
              ) : (
                <EmptyState message="No posts for the selected tags" />
              )}
            </div>
          </>
        )}

        {activeTab === 'Friends' && (
          <div key="friends" className="feed-animate">
            {friendsPostsState.length > 0 ? (
              friendsPostsState.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReply={openReply}
                  onHashtagClick={handleHashtagClick}
                  onUserClick={() => { const u = post.handle.replace('@', ''); router.push(u === 'you' ? '/profile' : `/profile/${u}`); }}
                  onReact={(emoji) => handleReact(post.id, emoji, post.hashtags)}
                  initialReactedEmoji={myReactionsMap[post.id] ?? null}
                  reactionCount={reactionCountsMap[post.id] ?? 0}
                  cardColor={cardColor || undefined}
                  hashtagBorderColor={hashtagColor || undefined}
                  isReplyLocked={post.hashtags.length > 0 && !post.hashtags.some(isTagEngaged)}
                />
              ))
            ) : (
              <EmptyState message="No posts for the selected tags" />
            )}
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
