'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/contexts/AuthContext';

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

type BubbleColor = 'auto' | 'pink' | 'lightblue' | 'purple' | 'orange' | 'green' | 'gold';

type Lang = 'ja' | 'en' | 'ko' | 'zh';

interface BubbleStyle { bgColor: string; borderColor: string; borderWidth: number; }
const DEFAULT_BUBBLE_STYLE: BubbleStyle = { bgColor: "#0d0d1a", borderColor: "#FF1A1A", borderWidth: 1 };

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

// ── カスタマイズ定数 ─────────────────────────────────────────────

const BUBBLE_COLOR_LABELS: Record<BubbleColor, string> = {
  auto: '時間帯自動', pink: 'ピンク', lightblue: '水色', purple: 'パープル',
  orange: 'オレンジ', green: 'グリーン', gold: 'ゴールド',
};

const BUBBLE_COLORS: { key: BubbleColor; bg: string; label: string }[] = [
  { key: 'auto',      bg: 'linear-gradient(135deg,#FFB347,#7EC8E3,#E8D5FF)', label: '自動'   },
  { key: 'pink',      bg: '#FFB6C1', label: 'ピンク'   },
  { key: 'lightblue', bg: '#87CEEB', label: '水色'     },
  { key: 'purple',    bg: '#C9A0FF', label: 'パープル' },
  { key: 'orange',    bg: '#FFA07A', label: 'オレンジ' },
  { key: 'green',     bg: '#90EE90', label: 'グリーン' },
  { key: 'gold',      bg: '#FFD700', label: 'ゴールド' },
];

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

// ── メインページ ─────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations('settings');
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/auth');
  };

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
  const [bubbleColor,  setBubbleColorState]  = useState<BubbleColor>('auto');
  const [expandCardBg,      setExpandCardBg]      = useState(false);
  const [expandHashtag,     setExpandHashtag]     = useState(false);
  const [expandBubble,      setExpandBubble]      = useState(false);
  const [expandBubbleStyle, setExpandBubbleStyle] = useState(false);
  const [bubbleStyle,       setBubbleStyleState]  = useState<BubbleStyle>(DEFAULT_BUBBLE_STYLE);
  const [expandChatMy,      setExpandChatMy]      = useState(false);
  const [expandChatTheir,   setExpandChatTheir]   = useState(false);
  const [myBubbleColor,     setMyBubbleColorState]    = useState<string>('rainbow');
  const [theirBubbleColor,  setTheirBubbleColorState] = useState<string>('');

  // 言語
  const [lang,     setLangState] = useState<Lang>('ja');
  const [langAuto, setLangAuto]  = useState(false);

  useEffect(() => {
    const bg  = localStorage.getItem('sync_card_bg');
    const htc = localStorage.getItem('sync_hashtag_color');
    const bbl = localStorage.getItem('sync_bubble_color') as BubbleColor | null;
    const lng = localStorage.getItem('sync_lang') as Lang | null;
    const myC   = localStorage.getItem('sync_my_bubble_color');
    const thrC  = localStorage.getItem('sync_their_bubble_color');
    if (bg  !== null) setCardBgState(bg);
    if (htc !== null) setHashtagColorState(htc);
    if (bbl) setBubbleColorState(bbl);
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

  function setCardBg(v: string)           { setCardBgState(v);        localStorage.setItem('sync_card_bg', v); }
  function setHashtagColor(v: string)     { setHashtagColorState(v); if (v) localStorage.setItem('sync_hashtag_color', v); else localStorage.removeItem('sync_hashtag_color'); }
  function setBubbleColor(v: BubbleColor) { setBubbleColorState(v); localStorage.setItem('sync_bubble_color', v); }
  function setMyBubbleColor(v: string)    { setMyBubbleColorState(v);    localStorage.setItem('sync_my_bubble_color',    v); }
  function setTheirBubbleColor(v: string) { setTheirBubbleColorState(v); localStorage.setItem('sync_their_bubble_color', v); }
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

          {/* 投稿カードの背景 */}
          <div style={{ borderBottom: expandCardBg ? 'none' : '1px solid var(--surface-2)' }}>
            <AccordionRow
              icon="🖼️" label={t('cardBg')}
              sub={cardBg || t('none')}
              expanded={expandCardBg}
              onToggle={() => setExpandCardBg(!expandCardBg)}
              borderBottom={!expandCardBg}
            />
            {expandCardBg && (
              <div style={{ ...expandPanelStyle, borderBottom: '1px solid var(--surface-2)' }}>
                {/* プレビュー */}
                <div style={{
                  marginTop: 12, marginBottom: 12,
                  padding: '10px 14px', borderRadius: 12,
                  background: cardBg || 'var(--surface-2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 13, color: 'rgba(255,255,255,0.85)',
                }}>
                  {t('previewText')}
                </div>

                {/* プリセット：透明 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <button
                    onClick={() => { setCardBg(''); localStorage.setItem('sync_card_bg', ''); }}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'transparent',
                      border: !cardBg ? '2px solid white' : '1.5px dashed rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: 'rgba(255,255,255,0.4)',
                    }}
                  >✕</button>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('transparent')}</span>
                </div>

                {/* 色相バー */}
                <div>
                  <p style={{ ...subLabelStyle, marginBottom: 8 }}>{t('hue')}</p>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    defaultValue={0}
                    onChange={(e) => {
                      const h = parseInt(e.target.value);
                      const s = 0.4, l = 0.2;
                      const a = s * Math.min(l, 1 - l);
                      const f = (n: number) => {
                        const k = (n + h / 30) % 12;
                        const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                        return Math.round(255 * c).toString(16).padStart(2, '0');
                      };
                      const hex = '#' + f(0) + f(8) + f(4);
                      setCardBg(hex);
                      localStorage.setItem('sync_card_bg', hex);
                    }}
                    style={{
                      width: '100%', height: 12, borderRadius: 6,
                      appearance: 'none', WebkitAppearance: 'none',
                      background: 'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ハッシュタグ枠色 */}
          <div style={{ borderBottom: expandHashtag ? 'none' : '1px solid var(--surface-2)' }}>
            <AccordionRow
              icon="#️⃣" label={t('hashtagBorder')}
              sub={hashtagColor || t('rainbow')}
              expanded={expandHashtag}
              onToggle={() => setExpandHashtag(!expandHashtag)}
              borderBottom={!expandHashtag}
            />
            {expandHashtag && (
              <div style={{ ...expandPanelStyle, borderBottom: '1px solid var(--surface-2)' }}>
                {/* プレビュー */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 14 }}>
                  {['#engineer', '#music', '#live'].map(tag => (
                    <span
                      key={tag}
                      style={hashtagColor ? {
                        padding: '2px 10px', borderRadius: 9999,
                        color: '#ffffff', display: 'inline-block',
                        fontSize: 12, border: `1.5px solid ${hashtagColor}`,
                        background: 'transparent',
                      } : {
                        padding: '2px 10px', borderRadius: 9999,
                        color: '#ffffff', display: 'inline-block',
                        fontSize: 12,
                        background: 'linear-gradient(var(--background),var(--background)) padding-box, linear-gradient(to right,#7C6FE8,#D455A8,#E84040,#E8A020,#48C468,#2890D8,#7C6FE8) border-box',
                        border: '1.5px solid transparent',
                      }}
                    >{tag}</span>
                  ))}
                </div>

                {/* 虹色リセットボタン */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <button
                    onClick={() => setHashtagColor('')}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8)',
                      border: !hashtagColor ? '2px solid white' : 'none',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('rainbow')}</span>
                </div>

                {/* 色相バー */}
                <div>
                  <p style={{ ...subLabelStyle, marginBottom: 8 }}>{t('hue')}</p>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    defaultValue={0}
                    onChange={(e) => {
                      const h = parseInt(e.target.value);
                      const s = 0.85, l = 0.55;
                      const a = s * Math.min(l, 1 - l);
                      const f = (n: number) => {
                        const k = (n + h / 30) % 12;
                        const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                        return Math.round(255 * c).toString(16).padStart(2, '0');
                      };
                      const hex = '#' + f(0) + f(8) + f(4);
                      setHashtagColor(hex);
                    }}
                    style={{
                      width: '100%', height: 12, borderRadius: 6,
                      appearance: 'none', WebkitAppearance: 'none',
                      background: 'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* バブルの色 */}
          <AccordionRow
            icon="🫧" label={t('bubbleColor')}
            sub={bubbleColor === 'auto' ? t('colorAuto') : bubbleColor === 'pink' ? t('colorPink') : bubbleColor === 'lightblue' ? t('colorLightblue') : bubbleColor === 'purple' ? t('colorPurple') : bubbleColor === 'orange' ? t('colorOrange') : bubbleColor === 'green' ? t('colorGreen') : t('colorGold')}
            expanded={expandBubble}
            onToggle={() => setExpandBubble(!expandBubble)}
            borderBottom={false}
          />
          {expandBubble && (
            <div style={{ ...expandPanelStyle, paddingTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {BUBBLE_COLORS.map(({ key, bg }) => (
                  <button key={key} onClick={() => setBubbleColor(key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: bg,
                      border: bubbleColor === key ? '3px solid #E63946' : '2px solid var(--surface-2)',
                      boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {key === 'auto' && <span style={{ fontSize: 16 }}>🕐</span>}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {key === 'auto' ? t('colorAuto') : key === 'pink' ? t('colorPink') : key === 'lightblue' ? t('colorLightblue') : key === 'purple' ? t('colorPurple') : key === 'orange' ? t('colorOrange') : key === 'green' ? t('colorGreen') : t('colorGold')}
                    </span>
                  </button>
                ))}
              </div>
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
                    background: bubbleStyle.bgColor,
                    borderWidth: bubbleStyle.borderColor === 'none' ? 0 : bubbleStyle.borderWidth,
                    borderStyle: 'solid',
                    borderColor: bubbleStyle.borderColor === 'rainbow' ? 'transparent' : bubbleStyle.borderColor === 'none' ? 'transparent' : bubbleStyle.borderColor,
                    borderImage: bubbleStyle.borderColor === 'rainbow'
                      ? 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6) 1'
                      : 'none',
                    fontSize: 13, color: '#fff',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)',
                  }}>
                    {t('previewBubbleText')}
                  </div>
                </div>
                {/* 背景色 */}
                <p style={subLabelStyle}>{t('bubbleBg')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="color"
                    value={bubbleStyle.bgColor.startsWith('#') ? bubbleStyle.bgColor : '#0d0d1a'}
                    onChange={e => updateBubbleStyle({ bgColor: e.target.value })}
                    style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--surface-2)', cursor: 'pointer', padding: 2 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{bubbleStyle.bgColor}</span>
                </div>
                {/* Bubble枠色 */}
                <p style={subLabelStyle}>{t('bubbleBorderLabel')}</p>

                {/* プリセット */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {/* 透明 */}
                  <button
                    onClick={() => updateBubbleStyle({ borderColor: 'none' })}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                      background: 'transparent',
                      border: bubbleStyle.borderColor === 'none'
                        ? '2px solid white'
                        : '1.5px dashed rgba(255,255,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: 'rgba(255,255,255,0.4)',
                    }}
                  >✕</button>
                  {/* 虹色 */}
                  <button
                    onClick={() => updateBubbleStyle({ borderColor: 'rainbow' })}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                      background: 'linear-gradient(135deg,#7C6FE8,#D455A8,#E84040,#E8A020,#48C468,#2890D8)',
                      border: bubbleStyle.borderColor === 'rainbow' ? '2px solid white' : 'none',
                    }}
                  />
                  {/* 白・黒 */}
                  {(['#ffffff', '#000000'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => updateBubbleStyle({ borderColor: c })}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                        background: c,
                        border: bubbleStyle.borderColor === c
                          ? '2px solid rgba(255,255,255,0.8)'
                          : c === '#ffffff' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                      }}
                    />
                  ))}
                </div>

                {/* 色相バー */}
                <div style={{ width: '100%', marginBottom: 4 }}>
                  <input
                    type="range" min={0} max={360} defaultValue={0}
                    onChange={(e) => {
                      const h = parseInt(e.target.value);
                      const s = 0.85, l = 0.55;
                      const a = s * Math.min(l, 1 - l);
                      const f = (n: number) => {
                        const k = (n + h / 30) % 12;
                        const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                        return Math.round(255 * c).toString(16).padStart(2, '0');
                      };
                      updateBubbleStyle({ borderColor: '#' + f(0) + f(8) + f(4) });
                    }}
                    style={{
                      width: '100%', height: 12, borderRadius: 6,
                      appearance: 'none', WebkitAppearance: 'none',
                      background: 'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)',
                      cursor: 'pointer',
                    } as React.CSSProperties}
                  />
                </div>
                {/* ボーダー太さ */}
                <p style={subLabelStyle}>{t('borderWidth', { width: bubbleStyle.borderWidth })}</p>
                <input
                  type="range" min={1} max={4} step={1}
                  value={bubbleStyle.borderWidth}
                  onChange={e => updateBubbleStyle({ borderWidth: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#FF1A1A' }}
                />
                {/* リセット */}
                <button
                  onClick={() => updateBubbleStyle(DEFAULT_BUBBLE_STYLE)}
                  style={{ marginTop: 14, width: '100%', padding: '9px 0', borderRadius: 10, border: '1px solid var(--surface-2)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}
                >
                  {t('resetDefault')}
                </button>
              </div>
            )}
          </div>

          {/* チャット吹き出し色 — 自分 */}
          <div style={{ borderTop: '1px solid var(--surface-2)', borderBottom: expandChatMy ? 'none' : '1px solid var(--surface-2)' }}>
            <AccordionRow
              icon="💬" label="自分の吹き出し色"
              sub={myBubbleColor === 'rainbow' ? '虹色（デフォルト）' : myBubbleColor}
              expanded={expandChatMy}
              onToggle={() => setExpandChatMy(!expandChatMy)}
              borderBottom={false}
            />
            {expandChatMy && (
              <div style={{ ...expandPanelStyle, borderBottom: '1px solid var(--surface-2)' }}>
                {/* プレビュー */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, marginBottom: 14 }}>
                  <div style={{
                    padding: '8px 14px',
                    borderRadius: '18px 18px 4px 18px',
                    background: myBubbleColor === 'rainbow'
                      ? 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)'
                      : myBubbleColor,
                    fontSize: 13, color: '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}>今日最高だった 🎸</div>
                </div>
                {/* 虹色リセット */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <button
                    onClick={() => setMyBubbleColor('rainbow')}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)',
                      border: myBubbleColor === 'rainbow' ? '2px solid white' : 'none',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>虹色（デフォルト）</span>
                </div>
                {/* 色相バー */}
                <div>
                  <p style={{ ...subLabelStyle, marginBottom: 8 }}>色相</p>
                  <input
                    type="range" min={0} max={360} defaultValue={0}
                    onChange={(e) => {
                      const h = parseInt(e.target.value);
                      const s = 0.85, l = 0.55;
                      const a = s * Math.min(l, 1 - l);
                      const f = (n: number) => {
                        const k = (n + h / 30) % 12;
                        const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                        return Math.round(255 * c).toString(16).padStart(2, '0');
                      };
                      setMyBubbleColor('#' + f(0) + f(8) + f(4));
                    }}
                    style={{
                      width: '100%', height: 12, borderRadius: 6,
                      appearance: 'none', WebkitAppearance: 'none',
                      background: 'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)',
                      cursor: 'pointer',
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            )}
          </div>

          {/* チャット吹き出し色 — 相手 */}
          <div>
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
                    padding: '8px 14px',
                    borderRadius: '18px 18px 18px 4px',
                    background: theirBubbleColor || 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(8px)',
                    fontSize: 13, color: '#fff',
                  }}>今日最高だった 🎸</div>
                </div>
                {/* デフォルトリセット */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <button
                    onClick={() => setTheirBubbleColor('')}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      border: !theirBubbleColor ? '2px solid white' : '1.5px solid rgba(255,255,255,0.3)',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>デフォルト（半透明）</span>
                </div>
                {/* 色相バー */}
                <div>
                  <p style={{ ...subLabelStyle, marginBottom: 8 }}>色相</p>
                  <input
                    type="range" min={0} max={360} defaultValue={0}
                    onChange={(e) => {
                      const h = parseInt(e.target.value);
                      const s = 0.7, l = 0.35;
                      const a = s * Math.min(l, 1 - l);
                      const f = (n: number) => {
                        const k = (n + h / 30) % 12;
                        const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                        return Math.round(255 * c).toString(16).padStart(2, '0');
                      };
                      setTheirBubbleColor('#' + f(0) + f(8) + f(4));
                    }}
                    style={{
                      width: '100%', height: 12, borderRadius: 6,
                      appearance: 'none', WebkitAppearance: 'none',
                      background: 'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)',
                      cursor: 'pointer',
                    } as React.CSSProperties}
                  />
                </div>
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

        {/* ⑤ 支払い */}
        <SectionHeader icon="💳" title={t('paymentSection')} />
        <div style={cardStyle}>
          <SettingRow
            icon="💳" label={t('paymentMethod')}
            value={t('paymentValue')}
            onTap={() => router.push('/payment')}
            borderBottom={false}
          />
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
