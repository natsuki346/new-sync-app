'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { type Post } from '@/lib/mockData';
import { PassionGraph } from '@/components/PassionGraph';
import PostCard from '@/components/PostCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min  < 1)  return 'たった今';
  if (min  < 60) return `${min}分前`;
  if (hour < 24) return `${hour}時間前`;
  return `${day}日前`;
}

function isUrl(s: string | null | undefined): boolean {
  return !!s && (s.startsWith('http://') || s.startsWith('https://'));
}

// ── 型定義 ────────────────────────────────────────────────────────

type ProfileData = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  header_url: string | null;
  bio: string | null;
  hashtags: string[];
};

// ── ページ本体 ────────────────────────────────────────────────────

export default function FriendProfilePage() {
  const params        = useParams();
  const profileUserId = params.userId as string;
  const router        = useRouter();
  const t             = useTranslations('profile');
  const { user, followedHashtags } = useAuth();

  // ── プロフィール
  const [profileUser,    setProfileUser]    = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!profileUserId) return;
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, header_url, bio, hashtags')
      .eq('username', profileUserId)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => {
        setProfileUser(data);
        setProfileLoading(false);
      });
  }, [profileUserId]);

  // ── PassionGraph 用データ（投稿ハッシュタグ頻度）
  const [passionItems, setPassionItems] = useState<{ tag: string; pct: number }[]>([]);

  useEffect(() => {
    if (!profileUser?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('posts') as any)
      .select('hashtags')
      .eq('user_id', profileUser.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (!data || data.length === 0) return;
        const counts: Record<string, number> = {};
        data.forEach(post => {
          (post.hashtags as string[])?.forEach(tag => {
            counts[tag] = (counts[tag] ?? 0) + 1;
          });
        });
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        if (total === 0) return;
        setPassionItems(
          Object.entries(counts)
            .map(([tag, count]) => ({ tag, pct: Math.round((count / total) * 100) }))
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 5)
        );
      });
  }, [profileUser?.id]);

  // ── 投稿リスト
  const [posts,        setPosts]        = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  useEffect(() => {
    if (!profileUser?.id) return;
    setPostsLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('posts') as any)
      .select('id, content, hashtags, color, is_mutual, expires_at, created_at')
      .eq('user_id', profileUser.id)
      .is('parent_id', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data, error }: { data: any[] | null; error: any }) => {
        if (error) console.error('投稿取得エラー:', error);
        if (data && profileUser) {
          setPosts(data.map(row => ({
            id:        row.id,
            avatar:    profileUser.avatar_url ?? '👤',
            handle:    '@' + profileUser.username,
            name:      profileUser.display_name,
            content:   row.content,
            hashtags:  row.hashtags ?? [],
            time:      getRelativeTime(row.created_at),
            createdAt: new Date(row.created_at).getTime(),
            expiresAt: row.expires_at
              ? new Date(row.expires_at).getTime()
              : Date.now() + 999 * 24 * 60 * 60 * 1000,
            isMutual:  row.is_mutual,
          })));
        }
        setPostsLoading(false);
      });
  }, [profileUser?.id]);

  // ── 共通ハッシュタグ
  const [commonTags,       setCommonTags]       = useState<string[]>([]);
  const [targetTagCount,   setTargetTagCount]   = useState(0);

  useEffect(() => {
    if (!profileUser?.id) return;
    supabase
      .from('follows')
      .select('tag')
      .eq('follower_id', profileUser.id)
      .eq('type', 'hashtag')
      .then(({ data }) => {
        const targetTags = (data ?? []).map((r: { tag: string | null }) => r.tag).filter(Boolean) as string[];
        setTargetTagCount(targetTags.length);
        if (user && followedHashtags.length > 0) {
          const targetSet = new Set(targetTags);
          setCommonTags(followedHashtags.filter(t => targetSet.has(t)));
        }
      });
  }, [profileUser?.id, user, followedHashtags]);

  // ── ピン止め投稿
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!profileUser?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('pinned_posts') as any)
      .select('order_index, posts(id, content, hashtags, color, is_mutual, expires_at, created_at)')
      .eq('user_id', profileUser.id)
      .order('order_index')
      .limit(3)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (!data || !profileUser) return;
        setPinnedPosts(
          data
            .filter(r => r.posts)
            .map(r => ({
              id:        r.posts.id,
              avatar:    profileUser.avatar_url ?? '👤',
              handle:    '@' + profileUser.username,
              name:      profileUser.display_name,
              content:   r.posts.content,
              hashtags:  r.posts.hashtags ?? [],
              time:      getRelativeTime(r.posts.created_at),
              createdAt: new Date(r.posts.created_at).getTime(),
              expiresAt: r.posts.expires_at
                ? new Date(r.posts.expires_at).getTime()
                : Date.now() + 999 * 24 * 60 * 60 * 1000,
              isMutual:  r.posts.is_mutual,
            }))
        );
      });
  }, [profileUser?.id]);

  // ── フォロー状態
  const [isFriend,      setIsFriend]      = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!user || !profileUser) return;
    supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profileUser.id)
      .eq('type', 'user')
      .maybeSingle()
      .then(({ data }) => setIsFriend(data !== null));
  }, [user, profileUser]);

  const handleFollow = async () => {
    if (!user || !profileUser || isFriend || followLoading) return;
    setFollowLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('follows') as any).insert({
      follower_id:  user.id,
      following_id: profileUser.id,
      type:         'user',
      status:       'accepted',
    });
    if (!error) setIsFriend(true);
    else console.error('フォローエラー:', error);
    setFollowLoading(false);
  };

  const hashtagColor = typeof window !== 'undefined'
    ? localStorage.getItem('sync_hashtag_color') || ''
    : '';

  const handleHashtagClick = useCallback((tag: string) => {
    router.push(`/search?tag=${encodeURIComponent(tag.replace(/^#/, ''))}`);
  }, [router]);

  // ── ローディング中
  if (profileLoading) return null;

  // ── プロフィールが見つからない場合
  if (!profileUser) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center" style={{ color: 'var(--muted)' }}>
        <p>ユーザーが見つかりません</p>
        <button onClick={() => router.back()} className="mt-4 text-sm underline">戻る</button>
      </div>
    );
  }

  const [c1, c2] = getCoverColors(profileUser.display_name);
  const avatarIsImg = isUrl(profileUser.avatar_url);

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-y-auto"
      style={{ background: 'var(--background)' }}
    >
      {/* ── カバー ─────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        <div
          className="h-36 w-full"
          style={profileUser.header_url ? undefined : {
            background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
          }}
        >
          {profileUser.header_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileUser.header_url}
              alt="header"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 65% 40%, rgba(255,26,26,0.10) 0%, transparent 65%)' }}
            />
          )}
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
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl overflow-hidden"
            style={{
              background: 'var(--surface-2)',
              border: '3px solid var(--background)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            {avatarIsImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileUser.avatar_url!}
                alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              profileUser.avatar_url ?? '👤'
            )}
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
            onClick={handleFollow}
            disabled={isFriend || followLoading}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-transform${isFriend ? '' : ' active:scale-[0.97]'}`}
            style={{
              background: isFriend ? 'var(--surface-2)' : 'var(--brand)',
              border: isFriend ? '1px solid var(--surface-2)' : 'none',
              color: isFriend ? 'var(--muted)' : '#0d0d1a',
              cursor: (isFriend || followLoading) ? 'default' : 'pointer',
              opacity: followLoading ? 0.6 : 1,
            }}
          >
            {isFriend ? t('friends') : followLoading ? '処理中...' : t('connect')}
          </button>
          <button
            onClick={() => router.push(`/chat/${profileUser.id}`)}
            className="px-4 py-1.5 rounded-full text-sm font-bold active:scale-[0.97] transition-transform"
            style={{ background: '#118AB2', color: '#fff' }}
          >
            DM
          </button>
        </div>

        <h1 className="text-base font-black leading-tight" style={{ color: 'var(--foreground)' }}>
          {profileUser.display_name}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          @{profileUser.username}
        </p>
        {profileUser.bio && (
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {profileUser.bio}
          </p>
        )}

        {/* ── フォロー中タグ数 + 共通タグ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {/* フォロー中のハッシュタグ数 */}
          <div style={{ color: '#aaa', fontSize: 13 }}>
            フォロー中のハッシュタグ：
            <span style={{ color: '#fff', fontWeight: 600, marginLeft: 4 }}>
              {targetTagCount}
            </span>
          </div>

          {/* 共通タグ */}
          {commonTags.length > 0 && (
            <div>
              <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>共通のハッシュタグ</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {commonTags.slice(0, 5).map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleHashtagClick(tag)}
                    style={hashtagColor ? {
                      background: 'transparent',
                      border: `1.5px solid ${hashtagColor}`,
                      color: '#fff',
                      borderRadius: 20,
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    } : {
                      background: 'linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(90deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF,#9B59B6) border-box',
                      border: '1.5px solid transparent',
                      color: '#fff',
                      borderRadius: 20,
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── PassionGraph */}
        {passionItems.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--surface-2)' }}>
            <PassionGraph items={passionItems} />
          </div>
        )}
      </div>

      {/* ── ピン止め投稿 ─────────────────────────────────────────── */}
      {pinnedPosts.length > 0 && (
        <div className="flex-shrink-0">
          <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>📌 ピン止め</span>
          </div>
          {pinnedPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onHashtagClick={handleHashtagClick}
              onUserClick={() => {}}
              hashtagBorderColor={hashtagColor || undefined}
            />
          ))}
          <div style={{ height: 1, background: 'var(--surface-2)', margin: '4px 0 0' }} />
        </div>
      )}

      {/* ── 投稿リスト ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-1">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Posts
        </p>
      </div>

      <div className="flex flex-col pb-10">
        {postsLoading ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>投稿がありません</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onHashtagClick={handleHashtagClick}
              onUserClick={() => {}}
              hashtagBorderColor={hashtagColor || undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
