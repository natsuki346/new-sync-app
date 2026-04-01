'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CONVERSATIONS, type Conversation } from '@/lib/mockData';

// ── 型 ────────────────────────────────────────────────────────────

type ChatMsg = {
  id: number;
  from: 'me' | 'them';
  text?: string;
  image?: string;
  time: string;
  isRead: boolean;
  dateLabel: string;
};

type DateSep = { type: 'date'; label: string; key: string };

// ── ヘルパー ──────────────────────────────────────────────────────

function nowTime() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const AUTO_REPLIES = [
  '...', '😊', 'Nice!', 'That sounds fun!', 'For sure!',
  '🔥', 'lol', 'Yeah!', '👍', 'Really?', 'Agreed~',
  "Let's do it!", '😂', 'Same here', "Can't wait!",
];

function buildInitialMessages(conv: Conversation): ChatMsg[] {
  if (!conv.preview) return [];
  return [
    { id: 1, from: 'them', text: `Hey! It's ${conv.name} 👋`,           time: '14:20', isRead: true,  dateLabel: 'Yesterday' },
    { id: 2, from: 'me',   text: 'Hey! Good to hear from you',           time: '14:22', isRead: true,  dateLabel: 'Yesterday' },
    { id: 3, from: 'them', text: "Let's catch up soon",                  time: '14:24', isRead: true,  dateLabel: 'Yesterday' },
    { id: 4, from: 'them', text: conv.preview,                           time: '09:10', isRead: true,  dateLabel: 'Today'     },
    { id: 5, from: 'me',   text: "Thanks! Let's talk more soon",         time: '09:14', isRead: true,  dateLabel: 'Today'     },
    { id: 6, from: 'them', text: "Definitely! When are you free next?",  time: '09:15', isRead: false, dateLabel: 'Today'     },
  ];
}

// ── メインコンポーネント ──────────────────────────────────────────

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const conv   = CONVERSATIONS.find((c) =>
    c.id === params.id ||
    c.name === params.id ||
    c.handle === `@${params.id}`
  ) ?? {
    id: params.id,
    avatar: '👤',
    name: params.id,
    handle: `@${params.id}`,
    preview: '',
    time: 'Now',
    unread: false,
    isGroup: false,
  };

  const [input,        setInput]        = useState('');
  const [messages,     setMessages]     = useState<ChatMsg[]>(() =>
    conv ? buildInitialMessages(conv) : [],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── テキスト送信 ──────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const txt = input.trim();
    if (!txt) return;
    const t = nowTime();
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, isRead: true })),
      { id: Date.now(), from: 'me' as const, text: txt, time: t, isRead: false, dateLabel: 'Today' },
    ]);
    setInput('');
    const delay = 1000 + Math.random() * 1500;
    setTimeout(() => {
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      setMessages((prev) => [
        ...prev.map((m) => (m.from === 'me' ? { ...m, isRead: true } : m)),
        { id: Date.now() + 1, from: 'them' as const, text: reply, time: nowTime(), isRead: true, dateLabel: 'Today' },
      ]);
    }, delay);
  }, [input]);

  // ── 画像送信 ──────────────────────────────────────────────────
  const sendImage = useCallback((dataUrl: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: 'me' as const, image: dataUrl, time: nowTime(), isRead: false, dateLabel: 'Today' },
    ]);
  }, []);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) sendImage(ev.target.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!conv) {
    router.replace('/chat');
    return null;
  }

  // 日付区切りを挿入
  const rendered: Array<ChatMsg | DateSep> = messages.reduce<Array<ChatMsg | DateSep>>(
    (acc, msg, i) => {
      const prev = messages[i - 1];
      if (!prev || prev.dateLabel !== msg.dateLabel) {
        acc.push({ type: 'date', label: msg.dateLabel, key: `d-${i}` });
      }
      acc.push(msg);
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── ヘッダー ─────────────────────────────────────────────── */}
      <header
        className="px-4 pt-12 pb-2 flex items-center gap-3 flex-shrink-0"
        style={{
          background: 'var(--background)',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        {/* 戻るボタン */}
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 active:scale-90 transition-transform"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className="w-4 h-4" style={{ color: 'var(--muted)' }}
          >
            <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* アバター */}
        {conv.isGroup ? (
          <MiniGroupAvatar avatars={conv.memberAvatars ?? []} />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}
          >
            {conv.avatar}
          </div>
        )}

        {/* 名前 + ステータス */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>
            {conv.name}
          </p>
          <p className="text-[10px] font-medium" style={{ color: 'rgba(136,136,170,0.55)' }}>
            {conv.isGroup && conv.memberAvatars
              ? `${conv.memberAvatars.length} members`
              : 'last seen recently'}
          </p>
        </div>

        {/* 通話・ビデオ・メニューボタン */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* 電話 */}
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            </svg>
          </button>
          {/* ビデオ */}
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 9.75v9A2.25 2.25 0 004.5 18.75z"
              />
            </svg>
          </button>
          {/* 3点メニュー */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor"
              className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <circle cx="12" cy="5"  r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── メッセージエリア ──────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5"
        style={{ background: 'var(--background)' }}
      >
        {rendered.map((item) => {

          if ('type' in item) {
            return (
              <div key={item.key} className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--surface-2)' }} />
                <span
                  className="text-[10px] font-medium px-3 py-1 rounded-full flex-shrink-0"
                  style={{
                    color: 'var(--muted)',
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-2)',
                  }}
                >
                  {item.label}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--surface-2)' }} />
              </div>
            );
          }

          const msg         = item as ChatMsg;
          const msgIdx      = messages.findIndex((m) => m.id === msg.id);
          const prevMsg     = messages[msgIdx - 1];
          const nextMsg     = messages[msgIdx + 1];
          const isMe        = msg.from === 'me';
          const showAvatar  = !isMe && (!prevMsg || prevMsg.from !== 'them' || prevMsg.dateLabel !== msg.dateLabel);
          const isLastGroup = !nextMsg || nextMsg.from !== msg.from || nextMsg.dateLabel !== msg.dateLabel;

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-1.5 mt-0.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${
                !showAvatar && !isMe ? 'pl-9' : ''
              }`}
            >
              {/* 相手アバター */}
              {!isMe && (
                <div className="w-8 h-8 flex-shrink-0 self-end mb-0.5">
                  {showAvatar ? (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      {conv.avatar}
                    </div>
                  ) : null}
                </div>
              )}

              {/* 吹き出し */}
              <div
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                style={{ maxWidth: '72%' }}
              >
                <div
                  className={`text-sm leading-relaxed select-none ${
                    msg.image ? 'overflow-hidden p-0' : 'px-3.5 py-2'
                  }`}
                  style={
                    isMe
                      ? {
                          background: 'var(--brand)',
                          color: '#ffffff',
                          borderRadius: '18px 18px 4px 18px',
                          fontWeight: 500,
                        }
                      : {
                          background: 'var(--surface)',
                          color: 'var(--foreground)',
                          border: '1px solid var(--surface-2)',
                          borderRadius: '18px 18px 18px 4px',
                        }
                  }
                >
                  {msg.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.image}
                      alt="sent image"
                      className="max-w-full max-h-60 object-cover"
                      style={{ borderRadius: 'inherit' }}
                    />
                  ) : (
                    msg.text
                  )}
                </div>
              </div>

              {/* 時刻 + 既読（グループ末尾のみ） */}
              {isLastGroup && (
                <div
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-0.5 flex-shrink-0 self-end mb-0.5`}
                >
                  {isMe && (
                    <span
                      className="text-[9px] font-medium leading-none"
                      style={{ color: msg.isRead ? 'var(--brand)' : 'var(--muted)' }}
                    >
                      {msg.isRead ? 'Read' : 'Sent'}
                    </span>
                  )}
                  <span className="text-[9px] leading-none" style={{ color: 'var(--muted)' }}>
                    {msg.time}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageFile}
      />

      {/* ── 入力エリア ────────────────────────────────────────────── */}
      <div
        className="border-t px-3 pt-2 pb-6 flex-shrink-0"
        style={{
          borderColor: 'var(--surface-2)',
          background: 'var(--background)',
        }}
      >
        <div className="flex items-center gap-2">

          {/* カメラボタン（常時表示） */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--surface-2)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
              />
            </svg>
          </button>

          {/* テキスト入力 */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Message…"
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--surface-2)',
              color: 'var(--foreground)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,26,26,0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--surface-2)';
            }}
          />

          {/* 右側ボタン群: 未入力→マイク・写真 / 入力中→送信 */}
          {input.trim() ? (
            /* 送信ボタン */
            <button
              onClick={sendMessage}
              className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-all"
              style={{
                background: 'var(--brand)',
                boxShadow: '0 0 14px rgba(255,26,26,0.55)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="#0d0d1a" className="w-4 h-4">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          ) : (
            /* マイク・写真 */
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* マイク */}
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                  className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
              {/* 写真 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                  className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── チャット設定パネル（右スライドイン） ─────────────────── */}
      {settingsOpen && (
        <div
          className="absolute inset-0 z-50 settings-slide"
          style={{ background: 'var(--background)' }}
        >
          {conv.isGroup
            ? <GroupSettings  conv={conv} onClose={() => setSettingsOpen(false)} />
            : <DmSettings     conv={conv} onClose={() => setSettingsOpen(false)} />
          }
        </div>
      )}

    </div>
  );
}

// ── ヘッダー用グループアバター ────────────────────────────────────

function MiniGroupAvatar({ avatars }: { avatars: string[] }) {
  const shown = avatars.slice(0, 2);
  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      {shown.map((av, i) => (
        <div
          key={i}
          className="absolute w-7 h-7 rounded-full flex items-center justify-center border-2"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--background)',
            top:      i === 0 ? 0 : 6,
            left:     i === 0 ? 0 : 6,
            fontSize: 12,
            zIndex:   i === 0 ? 1 : 2,
          }}
        >
          {av}
        </div>
      ))}
    </div>
  );
}

// ── 設定画面共通ヘッダー ──────────────────────────────────────────

function SettingsHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header
      className="px-4 pt-12 pb-3 flex items-center gap-3 flex-shrink-0"
      style={{
        background: 'var(--background)',
        borderBottom: '1px solid var(--surface-2)',
      }}
    >
      <button
        onClick={onBack}
        className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 active:scale-90 transition-transform"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="w-4 h-4" style={{ color: 'var(--muted)' }}
        >
          <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
        {title}
      </h2>
    </header>
  );
}

// ── メディアプレースホルダーグリッド ─────────────────────────────

function MediaGrid() {
  return (
    <div>
      <SectionLabel label="写真・動画" />
      <div className="grid grid-cols-3 gap-1 px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl"
            style={{
              background: `linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)`,
              border: '1px solid var(--surface-2)',
            }}
          />
        ))}
      </div>
      <button
        className="w-full text-center text-xs font-medium py-3 mt-1 active:opacity-60 transition-opacity"
        style={{ color: 'var(--brand)' }}
      >
        すべて見る
      </button>
    </div>
  );
}

// ── セクションラベル ──────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      className="px-4 pb-2 text-[11px] font-semibold tracking-wide uppercase"
      style={{ color: 'var(--muted)' }}
    >
      {label}
    </p>
  );
}

// ── セクション区切り ──────────────────────────────────────────────

function Divider() {
  return <div className="h-px mx-4 my-4" style={{ background: 'var(--surface-2)' }} />;
}

// ── 設定行コンポーネント ──────────────────────────────────────────

function SettingsRow({
  icon, label, color = 'var(--foreground)', chevron = true, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  chevron?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-4 px-4 py-3.5 active:opacity-60 transition-opacity text-left"
      onClick={onClick}
    >
      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
      >
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium" style={{ color }}>
        {label}
      </span>
      {chevron && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }}
        >
          <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </button>
  );
}

// ── トグル行 ─────────────────────────────────────────────────────

function ToggleRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
      >
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </span>
      {/* トグルスイッチ */}
      <button
        onClick={() => setOn((v) => !v)}
        className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
        style={{ background: on ? 'var(--brand)' : 'var(--surface-2)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
          style={{
            background: on ? '#0d0d1a' : 'var(--muted)',
            left: on ? 'calc(100% - 22px)' : '2px',
          }}
        />
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DM 設定画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DmSettings({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SettingsHeader title="トーク設定" onBack={onClose} />

      <div className="flex-1 overflow-y-auto">

        {/* プロフィールカード */}
        <div className="flex flex-col items-center pt-8 pb-6 px-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-3"
            style={{
              background: 'var(--surface-2)',
              border: '2px solid var(--surface-2)',
              boxShadow: '0 0 0 3px rgba(255,26,26,0.15)',
            }}
          >
            {conv.avatar}
          </div>
          <p className="text-base font-bold mb-0.5" style={{ color: 'var(--foreground)' }}>
            {conv.name}
          </p>
          {conv.handle && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {conv.handle}
            </p>
          )}
          <button
            className="mt-4 px-5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform"
            style={{
              background: 'rgba(255,26,26,0.1)',
              border: '1px solid rgba(255,26,26,0.3)',
              color: 'var(--brand)',
            }}
          >
            プロフィールを見る
          </button>
        </div>

        <Divider />

        {/* メディア */}
        <MediaGrid />

        <Divider />

        {/* 設定 */}
        <SectionLabel label="設定" />
        <ToggleRow icon="🔕" label="通知をオフにする" />

        <Divider />

        {/* 危険な操作 */}
        <SectionLabel label="その他" />
        <SettingsRow icon="🚫" label="ブロック"  color="#FF453A" />
        <SettingsRow icon="⚠️" label="報告する" color="#FF453A" />

        <div className="h-8" />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// グループ設定画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MEMBER_NAMES: Record<string, string> = {
  '🌸': 'yuki',  '🎵': 'mio',   '🎸': 'haru',  '🌊': 'sora',
  '📸': 'ren',   '🎞️': 'tomo',  '📷': 'kei',   '☕': 'nagi',
  '🖋️': 'ao',   '🌙': 'luna',  '💻': 'mai',   '🎨': 'kai',
};

function GroupSettings({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const [groupName, setGroupName] = useState(conv.name);
  const [editing,   setEditing]   = useState(false);
  const members = conv.memberAvatars ?? [];

  return (
    <div className="flex flex-col h-full">
      <SettingsHeader title="グループ設定" onBack={onClose} />

      <div className="flex-1 overflow-y-auto">

        {/* グループアイコン・名前編集 */}
        <div className="flex flex-col items-center pt-8 pb-6 px-4">
          {/* アイコン */}
          <div className="relative mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{
                background: 'var(--surface-2)',
                border: '2px solid var(--surface-2)',
                boxShadow: '0 0 0 3px rgba(255,26,26,0.15)',
              }}
            >
              {conv.avatar}
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--brand)',
                border: '2px solid var(--background)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}
                className="w-3.5 h-3.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
              </svg>
            </button>
          </div>

          {/* グループ名編集 */}
          {editing ? (
            <div className="flex items-center gap-2 w-full max-w-[240px]">
              <input
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="flex-1 text-center text-base font-bold rounded-xl px-3 py-1.5 outline-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(255,26,26,0.4)',
                  color: 'var(--foreground)',
                }}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
              />
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
              onClick={() => setEditing(true)}
            >
              <span className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                {groupName}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
              </svg>
            </button>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            {members.length} members
          </p>
        </div>

        <Divider />

        {/* イベント情報 */}
        <SectionLabel label="イベント" />
        <div
          className="mx-4 rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'rgba(255,26,26,0.1)', border: '1px solid rgba(255,26,26,0.2)' }}
          >
            🎸
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              JPRock Live 2024
            </p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              2024.12.15 · Zepp Tokyo
            </p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: 'var(--muted)' }}
          >
            <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>

        <Divider />

        {/* メンバー一覧 */}
        <div className="flex items-center justify-between px-4 mb-2">
          <SectionLabel label={`メンバー (${members.length})`} />
          <button
            className="text-xs font-semibold active:opacity-60 transition-opacity"
            style={{ color: 'var(--brand)' }}
          >
            + 追加
          </button>
        </div>
        <ul>
          {members.map((av) => {
            const name = MEMBER_NAMES[av] ?? 'unknown';
            return (
              <li key={av} className="flex items-center gap-3 px-4 py-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {av}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                    {name}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    @{name}
                  </p>
                </div>
                <button
                  className="text-[11px] font-medium px-3 py-1 rounded-full active:opacity-60 transition-opacity"
                  style={{
                    background: 'rgba(255,69,58,0.08)',
                    border: '1px solid rgba(255,69,58,0.2)',
                    color: '#FF453A',
                  }}
                >
                  削除
                </button>
              </li>
            );
          })}
        </ul>

        <Divider />

        {/* メディア */}
        <MediaGrid />

        <Divider />

        {/* 設定 */}
        <SectionLabel label="設定" />
        <ToggleRow icon="🔕" label="通知をオフにする" />

        <Divider />

        {/* 危険な操作 */}
        <SectionLabel label="その他" />
        <SettingsRow icon="🚪" label="グループを退出" color="#FF453A" />
        <SettingsRow icon="⚠️" label="報告する"       color="#FF453A" />

        <div className="h-8" />
      </div>
    </div>
  );
}
