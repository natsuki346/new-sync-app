'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <nav
      className="flex items-center justify-around px-8 pb-6 pt-3 flex-shrink-0"
      style={{ background: 'linear-gradient(to top, var(--background) 80%, transparent)' }}
    >
      {/* Home */}
      <Link href="/home" className="flex flex-col items-center gap-1">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive('/home') ? 'var(--brand)' : 'var(--muted)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
        <span
          className="text-xs font-medium"
          style={{ color: isActive('/home') ? 'var(--brand)' : 'var(--muted)' }}
        >
          Home
        </span>
      </Link>

      {/* Bubble (center gold circle) */}
      <Link
        href="/bubble"
        className="flex flex-col items-center gap-1"
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
          style={{
            background: isActive('/bubble')
              ? 'var(--brand)'
              : 'linear-gradient(135deg, #C9A84C, #a8862e)',
            boxShadow: isActive('/bubble')
              ? '0 0 20px rgba(201,168,76,0.6)'
              : '0 4px 12px rgba(201,168,76,0.3)',
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0d0d1a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <span
          className="text-xs font-medium"
          style={{ color: isActive('/bubble') ? 'var(--brand)' : 'var(--muted)' }}
        >
          Bubble
        </span>
      </Link>

      {/* Search */}
      <Link href="/search" className="flex flex-col items-center gap-1">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive('/search') ? 'var(--brand)' : 'var(--muted)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="22" y2="22" />
        </svg>
        <span
          className="text-xs font-medium"
          style={{ color: isActive('/search') ? 'var(--brand)' : 'var(--muted)' }}
        >
          Search
        </span>
      </Link>
    </nav>
  );
}
