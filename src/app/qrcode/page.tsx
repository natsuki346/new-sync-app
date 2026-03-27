'use client';

import { useRouter } from 'next/navigation';
import { CURRENT_USER } from '@/lib/mockData';

export default function QRCodePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--background)' }}>

      {/* ヘッダー */}
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
        <h1 className="text-base font-black" style={{ color: 'var(--foreground)' }}>QRコード</h1>
      </header>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 pt-10 pb-10">

        {/* アバター + 名前 */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4"
          style={{ background: 'var(--surface-2)', border: '3px solid var(--brand)' }}
        >
          {CURRENT_USER.avatar}
        </div>
        <p className="text-lg font-black mb-0.5" style={{ color: 'var(--foreground)' }}>{CURRENT_USER.name}</p>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>{CURRENT_USER.handle}</p>

        {/* QRコード */}
        <div
          className="w-full max-w-xs rounded-2xl p-5 mb-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
        >
          <div
            className="w-full rounded-xl overflow-hidden"
            style={{ aspectRatio: '1/1', border: '3px solid var(--foreground)' }}
          >
            <svg width="100%" height="100%" viewBox="0 0 21 21" style={{ display: 'block', background: '#fff' }}>
              {[
                [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[0,1],[6,1],
                [0,2],[2,2],[3,2],[4,2],[6,2],[0,3],[2,3],[3,3],[4,3],[6,3],
                [0,4],[2,4],[3,4],[4,4],[6,4],[0,5],[6,5],
                [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],
                [8,0],[10,0],[12,0],[9,1],[11,1],[13,1],
                [8,2],[10,2],[12,2],[14,2],[8,3],[11,3],[13,3],
                [0,8],[2,8],[4,8],[6,8],[1,9],[3,9],[5,9],[7,9],
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

          {/* スキャン説明 */}
          <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
            このQRコードをスキャンして<br />プロフィールを共有
          </p>
        </div>

        {/* フォロー中ハッシュタグ */}
        <div className="w-full max-w-xs">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>フォロー中のハッシュタグ</p>
          <div className="flex flex-wrap gap-1.5">
            {CURRENT_USER.hashtags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(201,168,76,0.08)',
                  border: '1px solid rgba(201,168,76,0.2)',
                  color: 'var(--brand)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
