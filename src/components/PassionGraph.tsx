'use client';

import { useState, useEffect } from 'react';

export interface PassionItem {
  tag: string;
  pct: number;
}

const HEAT_DEFAULT_COUNT = 5;

export function PassionGraph({ items }: { items: PassionItem[] }) {
  const [animated, setAnimated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(id);
  }, []);

  if (items.length === 0) return null;

  const visible  = expanded ? items : items.slice(0, HEAT_DEFAULT_COUNT);
  const hasMore  = items.length > HEAT_DEFAULT_COUNT;

  return (
    <div>
      <p
        className="mb-3"
        style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.04em', color: 'var(--foreground)' }}
      >
        HEAT MAP
      </p>

      <div className="space-y-2.5">
        {visible.map((item, idx) => {
          const isTop     = idx < 3;
          const barColor  = isTop
            ? 'linear-gradient(90deg, var(--brand), #e0c060)'
            : 'rgba(136,136,170,0.45)';
          const textColor = isTop ? 'var(--brand)' : 'var(--muted)';

          return (
            <div key={item.tag} className="flex items-center gap-2.5">
              {/* タグ名 */}
              <span
                className="text-[11px] font-medium flex-shrink-0 text-right"
                style={{ width: 72, color: 'var(--muted)' }}
              >
                {item.tag}
              </span>

              {/* バーグラフ */}
              <div
                className="flex-1 rounded-full overflow-hidden"
                style={{ height: 10, background: 'var(--surface-2)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width:      animated ? `${item.pct}%` : '0%',
                    background: barColor,
                    transition: `width 0.6s cubic-bezier(0.22,1,0.36,1) ${idx * 0.07}s`,
                  }}
                />
              </div>

              {/* パーセンテージ */}
              <span
                className="text-[11px] font-bold tabular-nums flex-shrink-0"
                style={{ width: 30, textAlign: 'right', color: textColor }}
              >
                {item.pct}%
              </span>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-semibold active:opacity-60 transition-opacity"
          style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {expanded ? '折りたたむ' : 'すべて表示'}
        </button>
      )}
    </div>
  );
}

// ── 自分の熱量データ ──────────────────────────────────────────────

export const MY_PASSION: PassionItem[] = [
  { tag: '#jprock',    pct: 45 },
  { tag: '#live',      pct: 38 },
  { tag: '#photo',     pct: 35 },
  { tag: '#night',     pct: 28 },
  { tag: '#coffee',    pct: 25 },
  { tag: '#film',      pct: 22 },
  { tag: '#music',     pct: 18 },
  { tag: '#minimal',   pct: 15 },
  { tag: '#design',    pct: 12 },
  { tag: '#engineer',  pct: 10 },
];
