'use client';

import { useRouter } from 'next/navigation';
import { MY_POSTS, type Post } from '@/lib/mockData';

const SAVED_POSTS = MY_POSTS.slice(0, 2);

export default function SavedPage() {
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
        <h1 className="text-base font-black" style={{ color: 'var(--foreground)' }}>保存済み</h1>
      </header>

      {/* 投稿リスト */}
      <div className="flex-1 overflow-y-auto">
        {SAVED_POSTS.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-4xl">🔖</span>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>保存した投稿はありません</p>
          </div>
        ) : (
          SAVED_POSTS.map((post) => <SavedCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}

function SavedCard({ post }: { post: Post }) {
  return (
    <div
      className="flex gap-3 px-4 py-4 active:opacity-80 transition-opacity cursor-pointer"
      style={{ borderBottom: '1px solid var(--surface-2)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
        style={{ background: 'var(--surface-2)' }}
      >
        {post.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
          <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{post.name}</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{post.handle}</span>
          <span className="text-xs ml-auto" style={{ color: 'rgba(136,136,170,0.5)' }}>{post.time}</span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-line mb-2" style={{ color: 'rgba(255,255,255,0.82)' }}>
          {post.content}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {post.hashtags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,26,26,0.08)', border: '1px solid rgba(255,26,26,0.2)', color: 'var(--brand)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
