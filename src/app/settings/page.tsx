'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { GENRES, GENRE_HASHTAGS } from '@/lib/genreHashtags';

const RAINBOW = 'linear-gradient(135deg, #7C6FE8, #A855F7, #EC4899, #F97316, #EAB308, #22C55E, #3B82F6)';

// ── 型 ───────────────────────────────────────────────────────────

interface NotificationSettings {
  reminderDay:  boolean;
  reminderPrev: boolean;
  reminderWeek: boolean;
  newEvents:    boolean;
  bubbleReply:  boolean;
  dm:           boolean;
  syncNews:     boolean;
}

type PrivacyScope = 'all' | 'followers';

// ── カスタマイズ型定義 ───────────────────────────────────────────

type Lang = 'ja' | 'en' | 'ko' | 'zh';

interface BubbleStyle { borderColor: string; borderWidth: number; }
const DEFAULT_BUBBLE_STYLE: BubbleStyle = { borderColor: "#FF1A1A", borderWidth: 1 };

// ── 言語定義 ─────────────────────────────────────────────────────

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh', label: '中文',   flag: '🇨🇳' },
];

function getDeviceLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const code = navigator.language.split('-')[0].toLowerCase() as Lang;
  return (['ja', 'en', 'ko', 'zh'] as Lang[]).includes(code) ? code : 'en';
}

// ── マスク表示 ───────────────────────────────────────────────────

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return local.slice(0, 2) + '***@' + domain;
}

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length < 4) return phone;
  return d.slice(0, 3) + '-****-' + d.slice(-4);
}

// ── トグルスイッチ ───────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13, position: 'relative',
        background: value ? '#E63946' : 'var(--surface-2)',
        transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

// ── セクションヘッダー ───────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 16px 8px' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', letterSpacing: 0.3 }}>{title}</span>
    </div>
  );
}

// ── 行コンポーネント ─────────────────────────────────────────────

function SettingRow({
  icon, label, value, onTap, rightSlot, borderBottom = true,
}: {
  icon: string; label: string; value?: string; onTap?: () => void;
  rightSlot?: React.ReactNode; borderBottom?: boolean;
}) {
  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 16px',
        borderBottom: borderBottom ? '1px solid var(--surface-2)' : 'none',
        background: 'var(--surface)',
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(255,26,26,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{label}</p>
        {value && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </p>
        )}
      </div>
      {rightSlot ?? (
        onTap && (
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--surface-2)" strokeWidth={2} style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        )
      )}
    </div>
  );
}

// ── インライン編集行 ─────────────────────────────────────────────

function EditableRow({
  icon, label, displayValue, inputType, placeholder, onSave, borderBottom = true,
}: {
  icon: string; label: string; displayValue: string;
  inputType?: string; placeholder?: string;
  onSave: (v: string) => void; borderBottom?: boolean;
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(displayValue);

  function save() {
    if (draft.trim()) onSave(draft.trim());
    setEditing(false);
  }

  return (
    <div style={{
      padding: '13px 16px',
      borderBottom: borderBottom ? '1px solid var(--surface-2)' : 'none',
      background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,26,26,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{label}</p>
          {!editing && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{displayValue}</p>
          )}
        </div>
        {!editing ? (
          <button
            onClick={() => { setDraft(displayValue); setEditing(true); }}
            style={{
              fontSize: 12, fontWeight: 600, padding: '5px 12px',
              borderRadius: 20, border: '1.5px solid #E63946',
              background: 'transparent', color: '#E63946', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {t('change')}
          </button>
        ) : (
          <button
            onClick={save}
            style={{
              fontSize: 12, fontWeight: 700, padding: '5px 12px',
              borderRadius: 20, border: 'none',
              background: '#E63946', color: '#fff', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {tc('save')}
          </button>
        )}
      </div>
      {editing && (
        <div style={{ marginTop: 10, paddingLeft: 48 }}>
          <input
            autoFocus
            type={inputType ?? 'text'}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1.5px solid #E63946', borderRadius: 10,
              fontSize: 14, outline: 'none',
              background: 'var(--surface-2)', color: 'var(--foreground)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── プライバシー公開範囲セレクター ────────────────────────────────

function ScopeSelector({ value, onChange }: { value: PrivacyScope; onChange: (v: PrivacyScope) => void }) {
  const t = useTranslations('settings');
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {(['all', 'followers'] as PrivacyScope[]).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            border: value === opt ? 'none' : '1.5px solid var(--surface-2)',
            background: value === opt ? '#E63946' : 'transparent',
            color: value === opt ? '#fff' : 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          {opt === 'all' ? t('scopeAll') : t('scopeFollowers')}
        </button>
      ))}
    </div>
  );
}

// ── アコーディオン行ヘッダー ─────────────────────────────────────

function AccordionRow({
  icon, label, sub, expanded, onToggle, borderBottom = true,
}: {
  icon: string; label: string; sub: string;
  expanded: boolean; onToggle: () => void; borderBottom?: boolean;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
        background: 'var(--surface)', cursor: 'pointer',
        borderBottom: expanded ? '1px solid var(--surface-2)' : borderBottom ? '1px solid var(--surface-2)' : 'none',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: 'rgba(255,26,26,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2}
        style={{ width: 16, height: 16, flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
        <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </div>
  );
}

// ── カラーピッカー ───────────────────────────────────────────────

const COLOR_PRESETS = [
  // グレー系
  '#000000','#1a1a1a','#333333','#555555','#777777','#999999','#bbbbbb','#dddddd','#ffffff',
  // 暖色系
  '#ff0000','#ff4444','#ff6b6b','#ff8e53','#ff9500','#ffcc00','#FFD93D','#ffeb3b','#fff176',
  // 緑系
  '#00c853','#6BCB77','#69f0ae','#b9f6ca','#00bcd4','#4dd0e1','#80deea','#e0f7fa',
  // 青系
  '#1565c0','#1976d2','#4D96FF','#42a5f5','#90caf9','#bbdefb','#7c4dff','#9B59B6','#ce93d8',
  // ピンク系
  '#e91e63','#f06292','#f48fb1','#fce4ec','#ff80ab','#ff4081',
  // ブラウン系
  '#4e342e','#795548','#a1887f','#d7ccc8',
  // その他
  '#ff6f00','#f57f17','#33691e','#1b5e20','#006064','#01579b','#311b92','#880e4f',
]

const BASIC_COLORS = ['', '#ffffff', '#111111', '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C9A0FF']

function CompactColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {label && (
          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 44, flexShrink: 0 }}>{label}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {BASIC_COLORS.map((color) => (
            <button
              key={color || 'default'}
              onClick={() => onChange(color)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: color || 'var(--surface-2)',
                border: value === color
                  ? '2.5px solid var(--foreground)'
                  : color === ''
                    ? '1.5px dashed var(--muted)'
                    : '1.5px solid transparent',
                cursor: 'pointer', flexShrink: 0, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {color === '' && (
                <span style={{ color: 'var(--muted)', fontSize: 10, lineHeight: 1 }}>A</span>
              )}
            </button>
          ))}
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: expanded ? '#E63946' : 'var(--surface-2)',
              border: 'none', cursor: 'pointer', padding: 0,
              color: expanded ? '#fff' : 'var(--muted)',
              fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >+</button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, maxWidth: '100%', boxSizing: 'border-box' as const, overflowX: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 4,
          }}>
            {COLOR_PRESETS.map(color => (
              <button
                key={color}
                onClick={() => { onChange(color); setExpanded(false); }}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: '50%',
                  background: color,
                  border: value === color ? '2.5px solid var(--foreground)' : '1.5px solid transparent',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 色相スライダー ───────────────────────────────────────────────

function HueSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const hueFromValue = (v: string) => {
    const m = v.match(/hsl\((\d+)/)
    return m ? parseInt(m[1]) : 0
  }
  const [hue, setHue] = useState(hueFromValue(value))
  const [isDefault, setIsDefault] = useState(!value)

  const handleChange = (h: number) => {
    setHue(h)
    setIsDefault(false)
    onChange(`hsl(${h}, 75%, 55%)`)
  }

  const handleDefault = () => {
    setIsDefault(true)
    onChange('')
  }

  const previewColor = isDefault
    ? 'linear-gradient(90deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF,#9B59B6)'
    : `hsl(${hue}, 75%, 55%)`

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>{label}</p>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: previewColor,
          border: '2px solid rgba(128,128,128,0.3)',
          flexShrink: 0,
        }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleDefault}
          style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0, padding: 0,
            background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)',
            border: isDefault ? '3px solid var(--foreground)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        />
        <div style={{ flex: 1, position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
          {/* レインボーバー背景 */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            height: 12, borderRadius: 9999,
            background: 'linear-gradient(to right, hsl(0,75%,55%), hsl(30,75%,55%), hsl(60,75%,55%), hsl(90,75%,55%), hsl(120,75%,55%), hsl(150,75%,55%), hsl(180,75%,55%), hsl(210,75%,55%), hsl(240,75%,55%), hsl(270,75%,55%), hsl(300,75%,55%), hsl(330,75%,55%), hsl(360,75%,55%))',
            pointerEvents: 'none',
          }} />
          {/* サムドット */}
          {!isDefault && (
            <div style={{
              position: 'absolute',
              left: `calc(${(hue / 360) * 100}% - 10px)`,
              width: 20, height: 20,
              borderRadius: '50%',
              background: `hsl(${hue}, 75%, 55%)`,
              border: '3px solid #ffffff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              zIndex: 2,
              transition: 'left 0.05s',
            }} />
          )}
          {/* 透明スライダー（操作用） */}
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={e => handleChange(Number(e.target.value))}
            style={{
              position: 'absolute', left: 0, right: 0,
              width: '100%', height: '100%',
              opacity: 0, cursor: 'pointer',
              margin: 0, zIndex: 3,
              WebkitAppearance: 'none',
            } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  )
}

// ── メインページ ─────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations('settings');
  const router = useRouter();
  const { signOut, followHashtag, unfollowHashtag, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/auth');
  };

  // テーマ検出
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ログインと連絡先
  const [email, setEmail] = useState('na***@gmail.com');
  const [phone, setPhone] = useState('090-****-1234');

  // 通知
  const [notif, setNotif] = useState<NotificationSettings>({
    reminderDay:  true,
    reminderPrev: true,
    reminderWeek: false,
    newEvents:    true,
    bubbleReply:  true,
    dm:           true,
    syncNews:     false,
  });

  // プライバシー
  const [bluetooth,    setBluetooth]    = useState(true);
  const [profileScope, setProfileScope] = useState<PrivacyScope>('all');

  // カスタマイズ
  const [cardBg,       setCardBgState]       = useState<string>('');
  const [hashtagColor, setHashtagColorState] = useState<string>('');
  const [postTextColor,   setPostTextColorState]   = useState<string>('');
  const [myMsgColor,      setMyMsgColorState]      = useState<string>('');
  const [theirMsgColor,   setTheirMsgColorState]   = useState<string>('');
  const [bubbleTextColor, setBubbleTextColorState] = useState<string>('');
  const [expandCardBg,      setExpandCardBg]      = useState(false);
  const [expandHashtag,     setExpandHashtag]     = useState(false);
  const [expandBubbleStyle, setExpandBubbleStyle] = useState(false);
  const [bubbleStyle,       setBubbleStyleState]  = useState<BubbleStyle>(DEFAULT_BUBBLE_STYLE);
  const [expandChatMy,      setExpandChatMy]      = useState(false);
  const [expandChatTheir,   setExpandChatTheir]   = useState(false);
  const [myBubbleColor,     setMyBubbleColorState]    = useState<string>('rainbow');
  const [theirBubbleColor,  setTheirBubbleColorState] = useState<string>('');

  // ジャンル
  const [expandedGenre, setExpandedGenre] = useState<string | null>(null);
  const [followedTags,  setFollowedTags]  = useState<Set<string>>(new Set());
  const [genreSearch,   setGenreSearch]   = useState('');

  // 言語
  const [lang,     setLangState] = useState<Lang>('ja');
  const [langAuto, setLangAuto]  = useState(false);

  useEffect(() => {
    const bg  = localStorage.getItem('sync_card_bg');
    const htc = localStorage.getItem('sync_hashtag_color');
    const lng = localStorage.getItem('sync_lang') as Lang | null;
    const myC   = localStorage.getItem('sync_my_bubble_color');
    const thrC  = localStorage.getItem('sync_their_bubble_color');
    if (bg  !== null) setCardBgState(bg);
    if (htc !== null) setHashtagColorState(htc);
    setPostTextColorState(localStorage.getItem('sync_post_text_color') || '');
    setMyMsgColorState(localStorage.getItem('sync_my_msg_color') || '');
    setTheirMsgColorState(localStorage.getItem('sync_their_msg_color') || '');
    setBubbleTextColorState(localStorage.getItem('sync_bubble_text_color') || '');
    if (myC  !== null) setMyBubbleColorState(myC);
    if (thrC !== null) setTheirBubbleColorState(thrC);
    if (lng) {
      setLangState(lng);
      setLangAuto(false);
    } else {
      setLangState(getDeviceLang());
      setLangAuto(true);
    }
    try {
      const bs = localStorage.getItem('bubble_style');
      if (bs) setBubbleStyleState(JSON.parse(bs) as BubbleStyle);
    } catch { /* ignore */ }
  }, []);

  // フォロー済みタグを Supabase から取得
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from('follows')
      .select('tag')
      .eq('follower_id', user.id)
      .eq('type', 'hashtag')
      .then(({ data }: { data: Array<{ tag: string }> | null }) => {
        setFollowedTags(new Set((data ?? []).map(r => r.tag).filter(Boolean)));
      });
  }, [user]);

  function setCardBg(v: string)       { setCardBgState(v);        localStorage.setItem('sync_card_bg', v); }
  function setHashtagColor(v: string) { setHashtagColorState(v); if (v) localStorage.setItem('sync_hashtag_color', v); else localStorage.removeItem('sync_hashtag_color'); }
  function setMyBubbleColor(v: string)    { setMyBubbleColorState(v);    localStorage.setItem('sync_my_bubble_color',    v); }
  function setTheirBubbleColor(v: string) { setTheirBubbleColorState(v); localStorage.setItem('sync_their_bubble_color', v); }
  function setPostTextColor(v: string)   { setPostTextColorState(v);   if (v) localStorage.setItem('sync_post_text_color',   v); else localStorage.removeItem('sync_post_text_color'); }
  function setMyMsgColor(v: string)      { setMyMsgColorState(v);      if (v) localStorage.setItem('sync_my_msg_color',       v); else localStorage.removeItem('sync_my_msg_color'); }
  function setTheirMsgColor(v: string)   { setTheirMsgColorState(v);   if (v) localStorage.setItem('sync_their_msg_color',    v); else localStorage.removeItem('sync_their_msg_color'); }
  function setBubbleTextColor(v: string) { setBubbleTextColorState(v); if (v) localStorage.setItem('sync_bubble_text_color',  v); else localStorage.removeItem('sync_bubble_text_color'); }
  function updateBubbleStyle(patch: Partial<BubbleStyle>) {
    setBubbleStyleState(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('bubble_style', JSON.stringify(next));
      return next;
    });
  }
  function setLang(v: Lang | 'auto') {
    if (v === 'auto') {
      setLangAuto(true);
      setLangState(getDeviceLang());
    } else {
      setLangAuto(false);
      setLangState(v);
    }
    setLanguage(v);
  }

  function setN(key: keyof NotificationSettings, val: boolean) {
    setNotif((prev) => ({ ...prev, [key]: val }));
  }

  // ジャンル検索フィルター
  const allGenreTags = useMemo(() =>
    [...new Set(GENRES.flatMap(g => GENRE_HASHTAGS[g.label] ?? []))],
    []
  );
  const searchResults = useMemo(() => {
    const q = genreSearch.trim();
    if (!q) return [];
    const matched = allGenreTags.filter(t => t.includes(q));
    if (matched.length === 0) {
      return [q.startsWith('#') ? q : `#${q}`];
    }
    return matched;
  }, [allGenreTags, genreSearch]);

  async function handleTagToggle(tag: string) {
    if (followedTags.has(tag)) {
      await unfollowHashtag(tag);
      setFollowedTags(prev => { const n = new Set(prev); n.delete(tag); return n; });
    } else {
      await followHashtag(tag);
      setFollowedTags(prev => new Set([...prev, tag]));
    }
  }

  function handleSaveEmail(v: string) {
    setEmail(maskEmail(v.includes('@') ? v : v + '@example.com'));
  }

  function handleSavePhone(v: string) {
    setPhone(maskPhone(v));
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 16,
    border: '1px solid var(--surface-2)',
    overflow: 'hidden',
    marginBottom: 4,
  };

  const expandPanelStyle: React.CSSProperties = {
    padding: '0 16px 16px',
    background: 'var(--surface)',
  };

  const subLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    marginBottom: 8, marginTop: 14,
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--background)' }}>

      {/* ── ヘッダー ── */}
      <header
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 14px), 14px)',
          paddingBottom: 12,
          borderBottom: '1px solid var(--surface-2)',
          background: 'var(--background)',
        }}
      >
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ background: 'var(--surface-2)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5" style={{ color: 'var(--foreground)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-base font-black" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
      </header>

      {/* ── スクロールエリア ── */}
      <div style={{ flex: 1, padding: '4px 16px 40px' }}>

        {/* ① ログインと連絡先情報 */}
        <SectionHeader icon="👤" title={t('loginContact')} />
        <div style={cardStyle}>
          <EditableRow
            icon="✉️" label={t('email')}
            displayValue={email}
            inputType="email" placeholder="example@gmail.com"
            onSave={handleSaveEmail}
          />
          <EditableRow
            icon="📱" label={t('phone')}
            displayValue={phone}
            inputType="tel" placeholder="090-0000-0000"
            onSave={handleSavePhone}
            borderBottom={false}
          />
        </div>

        {/* ② 通知設定 */}
        <SectionHeader icon="🔔" title={t('notifSection')} />
        <div style={cardStyle}>
          <SettingRow icon="📅" label={t('reminderDay')}   rightSlot={<Toggle value={notif.reminderDay}  onChange={(v) => setN('reminderDay',  v)} />} />
          <SettingRow icon="📅" label={t('reminderPrev')}   rightSlot={<Toggle value={notif.reminderPrev} onChange={(v) => setN('reminderPrev', v)} />} />
          <SettingRow icon="📅" label={t('reminderWeek')} rightSlot={<Toggle value={notif.reminderWeek} onChange={(v) => setN('reminderWeek', v)} />} />
          <SettingRow icon="🔖" label={t('newEvents')} rightSlot={<Toggle value={notif.newEvents}    onChange={(v) => setN('newEvents',    v)} />} />
          <SettingRow icon="💬" label={t('bubbleReply')}                 rightSlot={<Toggle value={notif.bubbleReply}  onChange={(v) => setN('bubbleReply',  v)} />} />
          <SettingRow icon="✉️" label={t('dmNotif')}                        rightSlot={<Toggle value={notif.dm}           onChange={(v) => setN('dm',           v)} />} />
          <SettingRow icon="📣" label={t('syncNews')}             rightSlot={<Toggle value={notif.syncNews}     onChange={(v) => setN('syncNews',     v)} />} borderBottom={false} />
        </div>

        {/* ③ カスタマイズ */}
        <SectionHeader icon="🎨" title={t('customize')} />
        <div style={cardStyle}>

          {/* 投稿カード */}
          <AccordionRow
            icon="🖼️" label={t('cardBg')}
            sub={cardBg || postTextColor ? (cardBg || t('none')) : t('none')}
            expanded={expandCardBg}
            onToggle={() => setExpandCardBg(!expandCardBg)}
          />
          {expandCardBg && (
            <div style={{ ...expandPanelStyle, borderBottom: '1px solid var(--surface-2)' }}>
              {/* プレビュー */}
              <div style={{
                marginTop: 12, marginBottom: 14,
                padding: '10px 14px', borderRadius: 12,
                background: cardBg || (isDark ? '#1a1a1a' : '#f0f0f0'),
                border: '1px solid rgb(var(--border-rgb))',
                fontSize: 13,
                color: postTextColor || 'var(--foreground)',
              }}>
                {t('previewText')}
              </div>
              {/* 背景色 */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, paddingTop: 4 }}>
                {/* デフォルト＝虹色 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <button
                    onClick={() => { setCardBg(''); localStorage.setItem('sync_card_bg', ''); }}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)',
                      border: !cardBg ? '3px solid #ffffff' : '2px solid transparent',
                      cursor: 'pointer', flexShrink: 0, padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {!cardBg && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '0 0 3px rgba(0,0,0,0.8)' }}>✓</span>}
                  </button>
                  <p style={{ color: 'var(--muted)', fontSize: 10, margin: '2px 0 0 0', textAlign: 'center' }}>
                    {isDark ? 'ダーク' : 'ライト'}
                  </p>
                </div>
                {/* 白 */}
                <button
                  onClick={() => { setCardBg('#ffffff'); localStorage.setItem('sync_card_bg', '#ffffff'); }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#ffffff',
                    border: cardBg === '#ffffff' ? '3px solid var(--foreground)' : '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer', flexShrink: 0, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {cardBg === '#ffffff' && <span style={{ color: '#000', fontSize: 11, fontWeight: 700 }}>✓</span>}
                </button>
                {/* 黒 */}
                <button
                  onClick={() => { setCardBg('#111111'); localStorage.setItem('sync_card_bg', '#111111'); }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#111111',
                    border: cardBg === '#111111' ? '3px solid #ffffff' : '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer', flexShrink: 0, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {cardBg === '#111111' && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                </button>
              </div>
              <HueSlider
                label="カード背景色"
                value={cardBg}
                onChange={setCardBg}
              />
              {/* 文字色 */}
              <p style={subLabelStyle}>文字色</p>
              <CompactColorPicker label="" value={postTextColor} onChange={setPostTextColor} />
            </div>
          )}

          {/* ハッシュタグ */}
          <AccordionRow
            icon="#️⃣" label={t('hashtagBorder')}
            sub={hashtagColor || t('rainbow')}
            expanded={expandHashtag}
            onToggle={() => setExpandHashtag(!expandHashtag)}
          />
          {expandHashtag && (
            <div style={{ ...expandPanelStyle, borderBottom: '1px solid var(--surface-2)' }}>
              {/* プレビュー */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 14 }}>
                {['#engineer', '#music', '#live'].map(tag => (
                  <span
                    key={tag}
                    style={hashtagColor ? {
                      padding: '2px 10px', borderRadius: 9999, display: 'inline-block',
                      fontSize: 12, border: `1.5px solid ${hashtagColor}`,
                      background: 'transparent', color: 'var(--foreground)',
                    } : {
                      padding: '2px 10px', borderRadius: 9999, display: 'inline-block',
                      fontSize: 12,
                      background: 'linear-gradient(var(--background),var(--background)) padding-box, linear-gradient(to right,#7C6FE8,#D455A8,#E84040,#E8A020,#48C468,#2890D8,#7C6FE8) border-box',
                      border: '1.5px solid transparent', color: 'var(--foreground)',
                    }}
                  >{tag}</span>
                ))}
              </div>
              {/* 枠色 */}
              <HueSlider
                label="枠の色"
                value={hashtagColor}
                onChange={setHashtagColor}
              />
            </div>
          )}

          {/* Bubbleカスタマイズ */}
          <div style={{ borderTop: '1px solid var(--surface-2)' }}>
            <div
              onClick={() => setExpandBubbleStyle(!expandBubbleStyle)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', background: 'var(--card)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🫧</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{t('bubbleCustomize')}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{t('bubbleAppearance')}</p>
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16, color: 'var(--muted)', transform: expandBubbleStyle ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {expandBubbleStyle && (
              <div style={{ ...expandPanelStyle, paddingTop: 12 }}>
                {/* プレビュー */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{
                    padding: '6px 16px', borderRadius: 20,
                    background: '#0d0d1a',
                    borderWidth: (!bubbleStyle.borderColor || bubbleStyle.borderColor === 'none') ? 0 : bubbleStyle.borderWidth,
                    borderStyle: 'solid',
                    borderColor: (!bubbleStyle.borderColor || bubbleStyle.borderColor === 'none') ? 'transparent' : bubbleStyle.borderColor,
                    borderImage: 'none',
                    fontSize: 13, color: bubbleTextColor || '#fff',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)',
                  }}>
                    {t('previewBubbleText')}
                  </div>
                </div>
                {/* Bubble枠色 */}
                <HueSlider
                  label={t('bubbleBorderLabel')}
                  value={bubbleStyle.borderColor.startsWith('hsl') ? bubbleStyle.borderColor : ''}
                  onChange={(c) => updateBubbleStyle({ borderColor: c || 'none' })}
                />
                {/* ボーダー太さ */}
                <p style={subLabelStyle}>{t('borderWidth', { width: bubbleStyle.borderWidth })}</p>
                <input
                  type="range" min={1} max={4} step={1}
                  value={bubbleStyle.borderWidth}
                  onChange={e => updateBubbleStyle({ borderWidth: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#FF1A1A', marginBottom: 14 }}
                />
                {/* 文字色 */}
                <p style={subLabelStyle}>文字色</p>
                <div style={{ marginBottom: 14 }}>
                  <CompactColorPicker label="" value={bubbleTextColor} onChange={setBubbleTextColor} />
                </div>
                {/* リセット */}
                <button
                  onClick={() => { updateBubbleStyle(DEFAULT_BUBBLE_STYLE); setBubbleTextColor(''); }}
                  style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: '1px solid var(--surface-2)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}
                >
                  {t('resetDefault')}
                </button>
              </div>
            )}
          </div>

          {/* チャット吹き出し色 — 自分 */}
          <div style={{ borderTop: '1px solid var(--surface-2)' }}>
            <AccordionRow
              icon="💬" label="自分の吹き出し色"
              sub={myBubbleColor === 'rainbow' ? '虹色（デフォルト）' : myBubbleColor || 'デフォルト'}
              expanded={expandChatMy}
              onToggle={() => setExpandChatMy(!expandChatMy)}
              borderBottom={false}
            />
            {expandChatMy && (
              <div style={{ ...expandPanelStyle, borderBottom: '1px solid var(--surface-2)' }}>
                {/* プレビュー */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, marginBottom: 14 }}>
                  <div style={{
                    padding: '8px 14px', borderRadius: '18px 18px 4px 18px',
                    background: myBubbleColor === 'rainbow'
                      ? 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)'
                      : myBubbleColor,
                    fontSize: 13, color: myMsgColor || '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}>今日最高だった 🎸</div>
                </div>
                {/* 背景色 */}
                <HueSlider
                  label="吹き出しの色"
                  value={myBubbleColor === 'rainbow' ? '' : myBubbleColor}
                  onChange={(v) => setMyBubbleColor(v || 'rainbow')}
                />
                {/* 文字色 */}
                <p style={subLabelStyle}>文字色</p>
                <CompactColorPicker label="" value={myMsgColor} onChange={setMyMsgColor} />
              </div>
            )}
          </div>

          {/* チャット吹き出し色 — 相手 */}
          <div style={{ borderTop: '1px solid var(--surface-2)' }}>
            <AccordionRow
              icon="💬" label="相手の吹き出し色"
              sub={theirBubbleColor || 'デフォルト（半透明）'}
              expanded={expandChatTheir}
              onToggle={() => setExpandChatTheir(!expandChatTheir)}
              borderBottom={false}
            />
            {expandChatTheir && (
              <div style={{ ...expandPanelStyle }}>
                {/* プレビュー */}
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 12, marginBottom: 14 }}>
                  <div style={{
                    padding: '8px 14px', borderRadius: '18px 18px 18px 4px',
                    background: theirBubbleColor || 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(8px)',
                    fontSize: 13, color: theirMsgColor || 'var(--foreground)',
                  }}>今日最高だった 🎸</div>
                </div>
                {/* 背景色 */}
                <HueSlider
                  label="吹き出しの色"
                  value={theirBubbleColor}
                  onChange={setTheirBubbleColor}
                />
                {/* 文字色 */}
                <p style={subLabelStyle}>文字色</p>
                <CompactColorPicker label="" value={theirMsgColor} onChange={setTheirMsgColor} />
              </div>
            )}
          </div>

        </div>

        {/* ④ プライバシー設定 */}
        <SectionHeader icon="🔒" title={t('privacySection')} />
        <div style={cardStyle}>
          <SettingRow
            icon="📡" label={t('bluetooth')}
            value={t('bluetoothDesc')}
            rightSlot={<Toggle value={bluetooth} onChange={setBluetooth} />}
          />
          <SettingRow
            icon="👁️" label={t('profileScope')}
            value={profileScope === 'all' ? t('scopeAll') : t('scopeFollowers')}
            rightSlot={<ScopeSelector value={profileScope} onChange={setProfileScope} />}
            borderBottom={false}
          />
        </div>

        {/* ⑤ 興味のあるジャンル */}
        <SectionHeader icon="🎯" title="興味のあるジャンル" />
        <p style={{ fontSize: 12, color: 'var(--muted)', padding: '0 4px 10px', lineHeight: 1.5 }}>
          タイムラインに表示されるコンテンツをカスタマイズできます
        </p>

        {/* 検索バー */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)', padding: '8px 12px',
          marginBottom: 12, boxSizing: 'border-box',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>🔍</span>
          <input
            type="text"
            value={genreSearch}
            onChange={e => setGenreSearch(e.target.value)}
            placeholder="ハッシュタグを検索…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--foreground)', fontSize: 14,
            }}
          />
          {genreSearch && (
            <button
              onClick={() => setGenreSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0, lineHeight: 1 }}
            >✕</button>
          )}
        </div>

        {/* 検索結果チップ */}
        {genreSearch.trim() && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {searchResults.map(tag => {
              const isFollowed = followedTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: isFollowed ? RAINBOW : 'rgba(255,255,255,0.08)',
                    color: isFollowed ? '#0d0d1a' : 'rgba(255,255,255,0.8)',
                    fontSize: 12, fontWeight: isFollowed ? 700 : 400,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {isFollowed ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
          </div>
        )}

        {/* ジャンルアコーディオン */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
          {GENRES.map(({ label, emoji }) => {
            const isExpanded = expandedGenre === label;
            const tags = GENRE_HASHTAGS[label] ?? [];
            const followedCount = tags.filter(t => followedTags.has(t)).length;
            return (
              <div key={label} style={{ gridColumn: isExpanded ? '1 / -1' : 'auto' }}>
                <button
                  type="button"
                  onClick={() => setExpandedGenre(isExpanded ? null : label)}
                  style={{
                    width: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '12px 6px', borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                    border: isExpanded ? '1.5px solid var(--brand)' : '1.5px solid rgba(255,255,255,0.08)',
                    borderBottom: isExpanded ? 'none' : undefined,
                    background: isExpanded ? 'rgba(124,111,232,0.12)' : 'rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isExpanded ? 'var(--foreground)' : 'rgba(255,255,255,0.7)', lineHeight: 1.3, textAlign: 'center' }}>
                    {label}
                  </span>
                  {followedCount > 0 && (
                    <span style={{ fontSize: 9, color: 'var(--brand)', fontWeight: 700 }}>
                      {followedCount}/{tags.length}
                    </span>
                  )}
                </button>
                {isExpanded && (
                  <div style={{
                    border: '1.5px solid var(--brand)', borderTop: 'none',
                    borderRadius: '0 0 12px 12px',
                    padding: '12px 10px',
                    background: 'rgba(124,111,232,0.06)',
                    display: 'flex', flexWrap: 'wrap', gap: 8,
                  }}>
                    {tags.map(tag => {
                      const isFollowed = followedTags.has(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          style={{
                            padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                            background: isFollowed ? 'var(--brand)' : 'rgba(255,255,255,0.08)',
                            color: isFollowed ? '#0d0d1a' : 'rgba(255,255,255,0.8)',
                            fontSize: 12, fontWeight: isFollowed ? 700 : 400,
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          {isFollowed ? `✓ ${tag}` : `+ ${tag}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ⑥ 言語設定 */}
        <SectionHeader icon="🌐" title={t('language')} />
        <div style={cardStyle}>
          {/* 端末の設定に従う */}
          <div
            onClick={() => setLang('auto')}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px',
              borderBottom: '1px solid var(--surface-2)',
              background: 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,26,26,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>
              📱
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{t('languageAuto')}</p>
            </div>
            {langAuto && (
              <svg viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth={2.5} style={{ width: 18, height: 18, flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </div>
          {LANGS.map((l, idx) => (
            <div
              key={l.code}
              onClick={() => setLang(l.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                borderBottom: idx < LANGS.length - 1 ? '1px solid var(--surface-2)' : 'none',
                background: 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,26,26,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>
                {l.flag}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{t(l.code)}</p>
              </div>
              {!langAuto && lang === l.code && (
                <svg viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth={2.5} style={{ width: 18, height: 18, flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </div>
          ))}
        </div>

        {/* ⑦ アカウント管理 */}
        <SectionHeader icon="⚠️" title={t('accountSection')} />
        <div style={cardStyle}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px',
              borderBottom: '1px solid var(--surface-2)',
              background: 'var(--surface)', cursor: 'pointer',
            }}
            onClick={handleLogout}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,68,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🚪</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#FF453A' }}>{t('logout')}</p>
          </div>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px',
              background: 'var(--surface)', cursor: 'pointer',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,68,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🗑</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#FF453A' }}>{t('deleteAccount')}</p>
          </div>
        </div>

        <p className="text-center text-xs py-8" style={{ color: 'rgba(136,136,170,0.35)' }}>
          SYNC. v1.0.0
        </p>

      </div>
    </div>
  );
}
