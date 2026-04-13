'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import BottomSheet from '@/components/BottomSheet';

export interface HashtagEngagement {
  tag:           string;
  follower_count: number | null;
  is_owner:      boolean | null;
}

interface HashtagCardProps {
  tag:         string;
  engagement?: HashtagEngagement;
  /** タップ時のカスタムハンドラ（省略時はsearch?tag=xxxへ遷移） */
  onTap?:      (tag: string) => void;
}

export default function HashtagCard({ tag, engagement, onTap }: HashtagCardProps) {
  const router = useRouter();
  const { user, followedHashtags, followHashtag, unfollowHashtag } = useAuth();
  const isFollowed = followedHashtags.includes(tag);
  const [showUnfollowSheet, setShowUnfollowSheet] = useState(false);

  const followerCount = engagement?.follower_count ?? null;
  const isOwner       = engagement?.is_owner ?? false;

  // #タグ → タグ名のみ（URLパラメータ用）
  const tagSlug = tag.replace(/^#/, '');

  function handleCardTap() {
    if (onTap) {
      onTap(tag);
    } else {
      router.push(`/search?tag=${encodeURIComponent(tagSlug)}`);
    }
  }

  async function handleFollowClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    if (isFollowed) {
      setShowUnfollowSheet(true);
    } else {
      await followHashtag(tag);
    }
  }

  async function handleUnfollowConfirm() {
    setShowUnfollowSheet(false);
    await unfollowHashtag(tag);
  }

  return (
    <>
      <div
        onClick={handleCardTap}
        style={{
          background:   '#1C1C1E',
          borderRadius: 16,
          padding:      '14px 16px',
          minWidth:     164,
          maxWidth:     164,
          flexShrink:   0,
          cursor:       'pointer',
          border:       '1px solid rgba(255,255,255,0.08)',
          display:      'flex',
          flexDirection:'column',
          gap:          10,
          userSelect:   'none',
          WebkitTapHighlightColor: 'transparent',
          transition:   'opacity 0.15s',
        }}
        className="active:opacity-70"
      >
        {/* タグ名 + オーナー王冠 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {isOwner && (
            <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>👑</span>
          )}
          <span
            style={{
              fontSize:     15,
              fontWeight:   800,
              color:        '#fff',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {tag}
          </span>
        </div>

        {/* フォロワー数 */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1 }}>
          {followerCount !== null
            ? `${followerCount.toLocaleString()} followers`
            : '— followers'}
        </p>

        {/* フォロー/フォロー中ボタン */}
        <button
          onClick={handleFollowClick}
          style={{
            width:        '100%',
            padding:      '7px 0',
            borderRadius: 20,
            fontSize:     12,
            fontWeight:   700,
            cursor:       'pointer',
            border:       isFollowed ? '1px solid rgba(255,255,255,0.18)' : 'none',
            background:   isFollowed
              ? 'rgba(255,255,255,0.08)'
              : 'linear-gradient(135deg,#FF6B6B,#FF8E53,#FFD93D,#6BCB77,#4D96FF,#9B59B6)',
            color:        isFollowed ? 'rgba(255,255,255,0.55)' : '#fff',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            gap:          4,
          }}
        >
          {isFollowed ? (
            <>
              フォロー中
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 9, height: 9, opacity: 0.55 }}>
                <path d="M8 10L3 5h10z" />
              </svg>
            </>
          ) : 'Follow'}
        </button>
      </div>

      {/* フォロー解除ボトムシート */}
      <BottomSheet open={showUnfollowSheet} onClose={() => setShowUnfollowSheet(false)}>
        <div style={{ padding: '12px 20px 16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{tag}</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            のフォローをやめますか？
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button
            onClick={handleUnfollowConfirm}
            style={{
              width: '100%', padding: '16px 20px',
              background: 'transparent', border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              color: '#FF453A', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            フォローをやめる
          </button>
          <button
            onClick={() => setShowUnfollowSheet(false)}
            style={{
              width: '100%', padding: '16px 20px',
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.45)', fontSize: 16, fontWeight: 500,
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            キャンセル
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
