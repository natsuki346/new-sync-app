'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import { MY_POSTS, MOCK_USERS, type Post } from '@/lib/mockData';
import { PassionGraph } from '@/components/PassionGraph';


// ── カバー色（名前ハッシュで決定） ────────────────────────────────

const COVER_PALETTES: [string, string][] = [
  ['#2D1B69', '#0D2A5B'],
  ['#1a0533', '#2D1A5C'],
  ['#0D3A6B', '#061A35'],
  ['#4A0D7A', '#200540'],
  ['#5C2A00', '#2A1000'],
  ['#0A3040', '#041520'],
];

function getCoverColors(name: string): [string, string] {
  const idx = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % COVER_PALETTES.length;
  return COVER_PALETTES[idx];
}

// ── 友達の投稿（MY_POSTSから流用 or 自動生成） ───────────────────

function getFriendPosts(handle: string, avatar: string, name: string): Post[] {
  const fromMock = MY_POSTS.filter((p) => p.handle === handle);
  if (fromMock.length > 0) return fromMock;
  const now = Date.now();
  const hr = 60 * 60 * 1000;
  return [
    {
      id: `${handle}-1`,
      avatar,
      handle,
      name,
      content: `毎日続けていることがある。\nそれが自分の一部になってきた。`,
      hashtags: [],
      time: '3h ago',
      createdAt: now - 3 * hr,
      expiresAt: now - 3 * hr + 72 * hr,
      isMutual: true,
    },
    {
      id: `${handle}-2`,
      avatar,
      handle,
      name,
      content: `また今日も同じ時間に目が覚めた。\n誰かと話したい気分。`,
      hashtags: [],
      time: '1d ago',
      createdAt: now - 24 * hr,
      expiresAt: now - 24 * hr + 72 * hr,
      isMutual: true,
    },
  ];
}

// ── ページ本体 ────────────────────────────────────────────────────

export default function FriendProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const router = useRouter();

  const user = MOCK_USERS.find(
    (u) =>
      u.id === userId ||
      u.name === userId ||
      u.handle === `@${userId}` ||
      u.handle === userId
  );
  if (!user) notFound();

  const alreadyFriend = user.isFriend;
  const [isFriend, setIsFriend] = useState(alreadyFriend);

  const [c1, c2] = getCoverColors(user.name);
  const posts = getFriendPosts(user.handle, user.avatar, user.name);

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-y-auto"
      style={{ background: 'var(--background)' }}
    >
      {/* ── カバー ─────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        <div
          className="h-36 w-full"
          style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 65% 40%, rgba(201,168,76,0.10) 0%, transparent 65%)' }}
          />
        </div>

        {/* 戻るボタン */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center px-3"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)', paddingBottom: 8 }}
        >
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        </div>

        {/* アバター */}
        <div className="absolute left-4" style={{ bottom: '-36px' }}>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{
              background: 'var(--surface-2)',
              border: '3px solid var(--background)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            {user.avatar}
          </div>
        </div>
      </div>

      {/* ── プロフィール情報 ─────────────────────────────────────── */}
      <div
        className="px-4 pt-14 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--surface-2)' }}
      >
        {/* ボタン行 */}
        <div className="flex items-center justify-end gap-2 mb-3">
          <button
            onClick={isFriend ? undefined : () => setIsFriend(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-transform${isFriend ? '' : ' active:scale-[0.97]'}`}
            style={{
              background: isFriend ? 'var(--surface-2)' : 'var(--brand)',
              border: isFriend ? '1px solid var(--surface-2)' : 'none',
              color: isFriend ? 'var(--muted)' : '#0d0d1a',
              cursor: isFriend ? 'default' : 'pointer',
            }}
          >
            {isFriend ? '友達' : 'つながる'}
          </button>
          <button
            onClick={() => router.push(`/chat/${userId}`)}
            className="px-4 py-1.5 rounded-full text-sm font-bold active:scale-[0.97] transition-transform"
            style={{ background: '#118AB2', color: '#fff' }}
          >
            DM
          </button>
        </div>

        <h1 className="text-base font-black leading-tight" style={{ color: 'var(--foreground)' }}>
          {user.name}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          {user.handle}
        </p>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--surface-2)' }}>
          <PassionGraph items={[]} />
        </div>
      </div>

      {/* ── 投稿リスト ───────────────────────────────────────────── */}
      <div className="flex flex-col pb-10">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex gap-3 px-4 py-4"
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
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.82)' }}>
                {post.content}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
