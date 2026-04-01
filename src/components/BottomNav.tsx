'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const RAINBOW_DARK = `linear-gradient(to right,
  #7C6FE8 0%,
  #D455A8 18%,
  #E84040 36%,
  #E8A020 52%,
  #48C468 68%,
  #2890D8 84%,
  #7C6FE8 100%
)`

const RAINBOW_LIGHT = `linear-gradient(to right,
  #5A50CC 0%,
  #C03090 18%,
  #D02828 36%,
  #C07C10 52%,
  #28A048 68%,
  #1070C0 84%,
  #5A50CC 100%
)`

// SVG fill用グラデーションのstops
const STOPS_DARK  = ['#7C6FE8','#D455A8','#E84040','#E8A020','#48C468','#2890D8','#7C6FE8']
const STOPS_LIGHT = ['#5A50CC','#C03090','#D02828','#C07C10','#28A048','#1070C0','#5A50CC']
const OFFSETS     = ['0%','16%','33%','50%','66%','83%','100%']

export default function BottomNav() {
  const pathname  = usePathname();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const RAINBOW = isDark ? RAINBOW_DARK : RAINBOW_LIGHT
  const stops   = isDark ? STOPS_DARK   : STOPS_LIGHT

  const isActive = (path: string) => pathname.startsWith(path);

  // アクティブ時のラベルグラデーション共通スタイル
  const activeLabel: React.CSSProperties = {
    background:           RAINBOW,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor:  'transparent',
    backgroundClip:       'text',
  }

  return (
    <nav
      className="flex items-center justify-around px-8 pb-6 pt-3 flex-shrink-0"
      style={{ background: 'linear-gradient(to top, var(--background) 80%, transparent)' }}
    >
      {/* Home */}
      <Link href="/home" className="flex flex-col items-center gap-1">
        <svg width="24" height="24" viewBox="0 0 24 24"
          fill="none" strokeLinecap="round" strokeLinejoin="round"
        >
          <defs>
            <linearGradient id="home-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
              {stops.map((c, i) => <stop key={i} offset={OFFSETS[i]} stopColor={c} />)}
            </linearGradient>
          </defs>
          {/* 家の外形 */}
          <path
            d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"
            fill={isActive('/home') ? 'url(#home-rainbow)' : 'none'}
            stroke={isActive('/home') ? 'none' : 'var(--muted)'}
            strokeWidth="2"
          />
          {/* ドア */}
          <path
            d="M9 21V12h6v9"
            fill={isActive('/home') ? 'url(#home-rainbow)' : 'none'}
            stroke={isActive('/home') ? 'none' : 'var(--muted)'}
            strokeWidth="2"
          />
        </svg>
        <span className="text-xs font-medium"
          style={isActive('/home') ? activeLabel : { color: 'var(--muted)' }}
        >
          Home
        </span>
      </Link>

      {/* Bubble (center rainbow circle) */}
      <Link href="/bubble" className="flex flex-col items-center gap-1">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
          style={{
            background: RAINBOW,
            boxShadow: isActive('/bubble')
              ? (isDark ? '0 0 20px rgba(124,111,232,0.5)' : '0 0 16px rgba(90,80,204,0.4)')
              : (isDark ? '0 4px 12px rgba(124,111,232,0.3)' : '0 4px 12px rgba(90,80,204,0.2)'),
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <span className="text-xs font-medium"
          style={isActive('/bubble') ? activeLabel : { color: 'var(--muted)' }}
        >
          Bubble
        </span>
      </Link>

      {/* Search */}
      <Link href="/search" className="flex flex-col items-center gap-1">
        <svg width="24" height="24" viewBox="0 0 24 24"
          fill="none" strokeLinecap="round" strokeLinejoin="round"
        >
          <defs>
            <linearGradient id="search-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
              {stops.map((c, i) => <stop key={i} offset={OFFSETS[i]} stopColor={c} />)}
            </linearGradient>
          </defs>
          {/* 虫眼鏡の円 */}
          <circle
            cx="11" cy="11" r="7"
            fill={isActive('/search') ? 'url(#search-rainbow)' : 'none'}
            stroke={isActive('/search') ? 'none' : 'var(--muted)'}
            strokeWidth="2"
          />
          {/* ハンドル（line要素はfill不可 → stroke で虹色） */}
          <line
            x1="16.5" y1="16.5" x2="22" y2="22"
            stroke={isActive('/search') ? 'url(#search-rainbow)' : 'var(--muted)'}
            strokeWidth="2"
          />
        </svg>
        <span className="text-xs font-medium"
          style={isActive('/search') ? activeLabel : { color: 'var(--muted)' }}
        >
          Search
        </span>
      </Link>
    </nav>
  );
}
