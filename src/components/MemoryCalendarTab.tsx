'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type HeatmapRow = {
  activity_date: string;  // 'YYYY-MM-DD'
  post_count: number;
  reaction_count: number;
  connection_count: number;
};

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  heatmapData: HeatmapRow[];
  loading: boolean;
}

export function MemoryCalendarTab({ heatmapData, loading }: Props) {
  const router = useRouter();
  const today = new Date();
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // activity_date をキーにしたルックアップ
  const lookup: Record<string, HeatmapRow> = {};
  for (const row of heatmapData) {
    lookup[row.activity_date] = row;
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedRow = selectedDay ? (lookup[selectedDay] ?? null) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-10">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-all"
          style={{ background: 'var(--surface-2)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4" style={{ color: 'var(--foreground)' }}>
            <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{year}年{month + 1}月</p>
        <button
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-all"
          style={{ background: 'var(--surface-2)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4" style={{ color: 'var(--foreground)' }}>
            <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DOW_LABELS.map((d, i) => (
          <p
            key={d}
            className="text-center text-[11px] font-bold py-1"
            style={{ color: i === 0 ? '#E63946' : i === 6 ? '#4A9EFF' : 'rgba(255,255,255,0.35)' }}
          >
            {d}
          </p>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 px-3 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const key        = dateKey(day);
          const row        = lookup[key];
          const hasPosts   = row && row.post_count > 0;
          const hasConnect = row && row.connection_count > 0;
          const isSelected = selectedDay === key;
          const isToday    = key === todayKey;
          const dow        = (firstDow + day - 1) % 7;

          return (
            <button
              key={key}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              className="flex flex-col items-center py-1.5 rounded-xl transition-all active:scale-90"
              style={{
                background: isSelected ? 'rgba(255,26,26,0.15)' : 'transparent',
                border: isSelected ? '1.5px solid rgba(255,26,26,0.45)' : '1.5px solid transparent',
              }}
            >
              <span
                className="text-[13px] leading-tight"
                style={{
                  fontWeight: isToday ? 800 : 500,
                  color: isToday ? '#FF1A1A' : dow === 0 ? '#E63946' : dow === 6 ? '#4A9EFF' : 'rgba(255,255,255,0.82)',
                }}
              >
                {day}
              </span>
              <div className="flex gap-[2px] mt-0.5 h-[9px] items-center">
                {hasPosts   && <span style={{ fontSize: 6, color: '#FF1A1A', lineHeight: 1 }}>●</span>}
                {hasConnect && <span style={{ fontSize: 6, color: '#E63946', lineHeight: 1 }}>♡</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="flex gap-4 px-5 pt-3">
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
          <span style={{ fontSize: 8, color: '#FF1A1A' }}>●</span> 投稿
        </span>
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
          <span style={{ fontSize: 8, color: '#E63946' }}>♡</span> つながり
        </span>
      </div>

      {/* アコーディオン詳細 */}
      {selectedDay && (
        <div
          className="mx-4 mt-4 rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
        >
          <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--surface-2)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{selectedDay}</p>
          </div>

          {!selectedRow || (selectedRow.post_count === 0 && selectedRow.connection_count === 0 && selectedRow.reaction_count === 0) ? (
            <p className="text-sm px-4 py-4" style={{ color: 'var(--muted)' }}>この日の記録はありません</p>
          ) : (
            <div>
              {selectedRow.post_count > 0 && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--surface-2)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#FF1A1A' }}>
                    <span>📝</span> 投稿
                  </p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {selectedRow.post_count}件の投稿
                  </p>
                </div>
              )}
              {selectedRow.reaction_count > 0 && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--surface-2)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#E63946' }}>
                    <span>❤️</span> リアクション
                  </p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {selectedRow.reaction_count}件のリアクション
                  </p>
                </div>
              )}
              {selectedRow.connection_count > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#E63946' }}>
                    <span>🤝</span> 新しいつながり
                  </p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {selectedRow.connection_count}件のつながり
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
