'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

// ── 型定義 ────────────────────────────────────────────────────────

type ApplicationStatus = 'applied' | 'cancelled' | 'free' | 'past';

interface HistoryEntry {
  id:          string;
  orderNumber: string;
  date:        string;
  status:      ApplicationStatus;
  eventName:   string;
  eventDate:   string;
  eventTs:     number;
  venue:       string;
  organizer:   string;
  hashtags:    string[];
  price:       number | null;
  ticketType:  string;
}

interface ReminderSettings {
  week:    boolean;
  day:     boolean;
  morning: boolean;
}


// ── ステータス設定 ────────────────────────────────────────────────

const STATUS_STYLE: Record<ApplicationStatus, { bg: string; color: string }> = {
  applied:   { bg: 'rgba(255,26,26,0.15)',  color: 'var(--brand)' },
  cancelled: { bg: 'var(--surface-2)',        color: 'var(--muted)' },
  free:      { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  past:      { bg: 'var(--surface-2)',        color: 'var(--muted)' },
};

// ── カウントダウン計算 ────────────────────────────────────────────

interface CountdownResult {
  days: number; hours: number; mins: number; secs: number;
  urgent: boolean; today: boolean; past: boolean;
}

function calcCountdown(eventTs: number, now: number): CountdownResult {
  const diff = eventTs - now;
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, urgent: false, today: false, past: true };
  const ed = new Date(eventTs), nd = new Date(now);
  const isToday =
    ed.getFullYear() === nd.getFullYear() &&
    ed.getMonth()    === nd.getMonth()    &&
    ed.getDate()     === nd.getDate();
  if (isToday) {
    const s = Math.floor(diff / 1000);
    return { days: 0, hours: Math.floor(s / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60, urgent: true, today: true, past: false };
  }
  const s = Math.floor(diff / 1000);
  return {
    days:  Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins:  Math.floor((s % 3600) / 60),
    secs:  s % 60,
    urgent: diff < 24 * 3600 * 1000,
    today: false, past: false,
  };
}

// ── カウントダウンUI ─────────────────────────────────────────────

function CountdownBoxes({ cd }: { cd: CountdownResult }) {
  const t        = useTranslations('history');
  const boxBg    = cd.urgent ? 'var(--brand)' : 'var(--surface)';
  const labelCol = cd.urgent ? 'rgba(255,26,26,0.7)' : 'var(--muted)';

  function Box({ value, label }: { value: number; label: string }) {
    return (
      <div className="flex flex-col items-center" style={{ gap: 3 }}>
        <div style={{
          background: boxBg, borderRadius: 6, width: 34, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--surface-2)',
        }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {String(value).padStart(2, '0')}
          </span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 600, color: labelCol }}>{label}</span>
      </div>
    );
  }

  function Sep() {
    return <span style={{ color: boxBg, fontWeight: 800, fontSize: 14, marginBottom: 10 }}>:</span>;
  }

  if (cd.today) return <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>TODAY</span>;
  if (cd.past)  return <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('past')}</span>;

  return (
    <div className="flex items-center" style={{ gap: 3 }}>
      <Box value={cd.days}  label="d" />
      <Sep />
      <Box value={cd.hours} label="h" />
      <Sep />
      <Box value={cd.mins}  label="m" />
      <Sep />
      <Box value={cd.secs}  label="s" />
    </div>
  );
}

// ── リマインダーシート ────────────────────────────────────────────

const DEFAULT_REMINDER: ReminderSettings = { week: false, day: false, morning: false };

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13, position: 'relative',
        background: value ? 'var(--brand)' : 'var(--surface-2)',
        transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s',
      }} />
    </div>
  );
}

function ReminderSheet({
  entry, settings, onSave, onClose,
}: {
  entry: HistoryEntry; settings: ReminderSettings;
  onSave: (s: ReminderSettings) => void; onClose: () => void;
}) {
  const t = useTranslations('history');
  const tc = useTranslations('common');
  const [draft, setDraft] = useState<ReminderSettings>(settings);
  const rows: { key: keyof ReminderSettings; label: string; sub: string }[] = [
    { key: 'week',    label: t('reminderWeek'),    sub: t('reminderWeekSub') },
    { key: 'day',     label: t('reminderDay'),     sub: t('reminderDaySub') },
    { key: 'morning', label: t('reminderMorning'), sub: t('reminderMorningSub') },
  ];

  return (
    <div
      className="absolute inset-0 z-60"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col sheet-animate"
        style={{
          background: 'var(--surface)', borderRadius: '20px 20px 0 0',
          padding: '20px 20px 48px', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--surface-2)' }} />
        <p className="font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>{t('reminderTitle')}</p>
        <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>{entry.eventName}</p>
        <div className="flex flex-col mb-6" style={{ gap: 0, border: '1px solid var(--surface-2)', borderRadius: 14, overflow: 'hidden' }}>
          {rows.map((row, i) => (
            <div key={row.key} className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--surface-2)' : 'none' }}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{row.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{row.sub}</p>
              </div>
              <Toggle value={draft[row.key]} onChange={(v) => setDraft((d) => ({ ...d, [row.key]: v }))} />
            </div>
          ))}
        </div>
        <button
          onClick={() => { onSave(draft); onClose(); }}
          className="w-full py-3.5 rounded-xl font-bold text-sm"
          style={{ background: 'var(--brand)', color: '#000' }}
        >
          {tc('save')}
        </button>
      </div>
    </div>
  );
}

// ── QRモーダル ───────────────────────────────────────────────────

function QRModal({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const t = useTranslations('history');
  const tc = useTranslations('common');
  return (
    <div
      className="absolute inset-0 z-50"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col sheet-animate"
        style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: '24px 24px 64px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--surface-2)' }} />
        <p className="text-center font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>{t('ticketQr')}</p>
        <p className="text-center text-xs mb-6" style={{ color: 'var(--muted)' }}>{entry.eventName}</p>

        <div className="w-full max-w-xs mx-auto mb-5">
          <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: '1/1', border: '3px solid var(--foreground)' }}>
            <svg width="100%" height="100%" viewBox="0 0 21 21" style={{ display: 'block', background: '#fff' }}>
              {[
                [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[0,1],[6,1],
                [0,2],[2,2],[3,2],[4,2],[6,2],[0,3],[2,3],[3,3],[4,3],[6,3],
                [0,4],[2,4],[3,4],[4,4],[6,4],[0,5],[6,5],
                [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],
                [8,0],[10,0],[12,0],[9,1],[11,1],[13,1],[8,2],[10,2],[12,2],[14,2],
                [8,3],[11,3],[13,3],[0,8],[2,8],[4,8],[6,8],[1,9],[3,9],[5,9],[7,9],
                [0,10],[2,10],[4,10],[6,10],[8,10],[10,10],[12,10],
                [14,0],[14,1],[14,2],[14,3],[14,4],[14,5],[14,6],
                [14,8],[14,9],[14,10],[14,11],[14,12],[14,13],[14,14],
                [0,14],[1,14],[2,14],[3,14],[4,14],[5,14],[6,14],
                [0,13],[6,13],[0,12],[2,12],[3,12],[4,12],[6,12],[0,11],[6,11],
                [8,12],[9,12],[10,12],[11,12],[12,12],[8,13],[10,13],[12,13],[9,14],[11,14],[13,14],
                [16,0],[17,0],[18,0],[19,0],[20,0],[16,2],[18,2],[20,2],
                [16,4],[17,4],[18,4],[19,4],[20,4],[16,6],[20,6],
                [16,8],[17,8],[18,8],[19,8],[20,8],[16,10],[18,10],[20,10],
                [16,12],[17,12],[18,12],[19,12],[20,12],[16,14],[18,14],[20,14],
              ].map(([x, y], i) => (
                <rect key={i} x={x} y={y} width={1} height={1} fill="#1A1A1A" />
              ))}
            </svg>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3 mb-5" style={{ background: 'var(--surface-2)' }}>
          {[
            { label: t('orderNumber'), value: entry.orderNumber },
            { label: t('ticketType'), value: entry.ticketType },
            { label: t('eventDate'), value: entry.eventDate },
          ].map((row, i, arr) => (
            <div key={row.label} className="flex justify-between" style={{ marginBottom: i < arr.length - 1 ? 6 : 0 }}>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{row.label}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{row.value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl font-bold text-sm"
          style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
        >
          {tc('close')}
        </button>
      </div>
    </div>
  );
}

// ── 履歴カード ───────────────────────────────────────────────────

function HistoryCard({
  entry, now, reminder, onShowQR, onOpenReminder,
}: {
  entry:          HistoryEntry;
  now:            number;
  reminder:       ReminderSettings;
  onShowQR:       (e: HistoryEntry) => void;
  onOpenReminder: (e: HistoryEntry) => void;
}) {
  const t = useTranslations('history');
  const statusLabelMap: Record<ApplicationStatus, string> = {
    applied: t('applied'), cancelled: t('cancelled'), free: t('free'), past: t('past'),
  };
  const status      = STATUS_STYLE[entry.status];
  const isCancelled = entry.status === 'cancelled';
  const cd          = calcCountdown(entry.eventTs, now);
  const hasReminder = reminder.week || reminder.day || reminder.morning;

  return (
    <div
      className="rounded-2xl mb-3 overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${cd.today ? 'rgba(255,26,26,0.4)' : 'var(--surface-2)'}`,
        opacity: isCancelled ? 0.6 : 1,
        boxShadow: cd.today ? '0 0 0 2px rgba(255,26,26,0.15)' : 'none',
      }}
    >
      {/* カードヘッダー */}
      <div
        className="flex justify-between items-center px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--surface-2)', background: 'rgba(255,255,255,0.02)' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{entry.date} · {entry.orderNumber}</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: status.bg, color: status.color }}
        >
          {statusLabelMap[entry.status]}
        </span>
      </div>

      {/* カウントダウンバー */}
      {!isCancelled && (
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--surface-2)', background: 'rgba(255,255,255,0.02)' }}
        >
          <CountdownBoxes cd={cd} />
          {!cd.past && (
            <button
              onClick={() => onOpenReminder(entry)}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold"
              style={{
                border: `1.5px solid ${hasReminder ? 'var(--brand)' : 'var(--surface-2)'}`,
                background: hasReminder ? 'rgba(255,26,26,0.1)' : 'transparent',
                color: hasReminder ? 'var(--brand)' : 'var(--muted)',
              }}
            >
              <span style={{ fontSize: 12 }}>{hasReminder ? '🔔' : '🔕'}</span>
              {t('reminder')}
            </button>
          )}
        </div>
      )}

      {/* イベント詳細 */}
      <div className="px-4 py-3.5">
        <p className="font-bold text-sm mb-2.5" style={{ color: 'var(--foreground)' }}>{entry.eventName}</p>

        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { icon: '📅', text: entry.eventDate },
            { icon: '📍', text: entry.venue },
            { icon: '👤', text: entry.organizer },
            ...(entry.price !== null
              ? [{ icon: '💴', text: `¥${entry.price.toLocaleString()} · ${entry.ticketType}` }]
              : []),
          ].map((row) => (
            <div key={row.icon + row.text} className="flex items-center gap-2">
              <span className="text-xs" style={{ width: 16, textAlign: 'center' }}>{row.icon}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>{row.text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {entry.hashtags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(255,26,26,0.08)', color: 'var(--brand)', border: '1px solid rgba(255,26,26,0.2)' }}
            >
              {tag}
            </span>
          ))}
        </div>

        {!isCancelled && (
          <button
            onClick={() => onShowQR(entry)}
            className="w-full py-2.5 rounded-xl text-xs font-bold"
            style={{ background: 'var(--brand)', color: '#000' }}
          >
            {t('showQr')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── メインページ ─────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const t  = useTranslations('history');
  const tc = useTranslations('common');
  const [now,           setNow]           = useState(() => Date.now());
  const [qrEntry,       setQrEntry]       = useState<HistoryEntry | null>(null);
  const [reminderEntry, setReminderEntry] = useState<HistoryEntry | null>(null);
  const [reminders,     setReminders]     = useState<Record<string, ReminderSettings>>({});
  const [yearFilter,    setYearFilter]    = useState<'2026' | '2025'>('2026');

  const historyData: HistoryEntry[] = [];

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function saveReminder(entryId: string, settings: ReminderSettings) {
    setReminders((prev) => ({ ...prev, [entryId]: settings }));
  }

  const filtered = historyData.filter((e) => e.date.startsWith(yearFilter));

  return (
    <div className="flex flex-col flex-1 min-h-0 relative" style={{ background: 'var(--background)' }}>

      {/* ヘッダー */}
      <header
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 14px), 14px)',
          paddingBottom: 12,
          borderBottom: '1px solid var(--surface-2)',
          background: 'var(--background)',
        }}
      >
        <div className="flex items-center gap-3">
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
        </div>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value as '2026' | '2025')}
          className="text-sm font-semibold rounded-full px-3 py-1.5 outline-none"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--surface-2)',
            color: 'var(--foreground)',
          }}
        >
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
      </header>

      {/* 件数 */}
      <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--surface-2)' }}>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {t('countInfo', { year: yearFilter, count: filtered.length })}
        </span>
      </div>

      {/* リスト */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-4xl">📭</span>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('noHistory')}</p>
          </div>
        ) : (
          filtered.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              now={now}
              reminder={reminders[entry.id] ?? DEFAULT_REMINDER}
              onShowQR={setQrEntry}
              onOpenReminder={setReminderEntry}
            />
          ))
        )}
      </div>

      {/* QRモーダル */}
      {qrEntry && <QRModal entry={qrEntry} onClose={() => setQrEntry(null)} />}

      {/* リマインダーシート */}
      {reminderEntry && (
        <ReminderSheet
          entry={reminderEntry}
          settings={reminders[reminderEntry.id] ?? DEFAULT_REMINDER}
          onSave={(s) => saveReminder(reminderEntry.id, s)}
          onClose={() => setReminderEntry(null)}
        />
      )}
    </div>
  );
}
