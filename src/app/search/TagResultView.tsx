'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Phase = 'loading' | 'owner_screen' | 'animating' | 'normal'

type Props = {
  tag: string
  onBack: () => void
}

export default function TagResultView({ tag, onBack }: Props) {
  const { user } = useAuth()
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  const displayTag = normalizedTag.replace(/^#/, '')

  const [phase, setPhase] = useState<Phase>('loading')
  const [followerCount, setFollowerCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [engagement, setEngagement] = useState({ post_count: 0, reaction_count: 0 })

  const POST_GOAL = 3
  const REACTION_GOAL = 10

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedTag])

  async function load() {
    setPhase('loading')

    const { count: fc } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'hashtag')
      .eq('tag', normalizedTag)

    setFollowerCount(fc ?? 0)

    let selfFollow = false
    if (user) {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('type', 'hashtag')
        .eq('tag', normalizedTag)
        .eq('follower_id', user.id)
        .maybeSingle()
      selfFollow = !!data
    }
    setIsFollowing(selfFollow)

    // hashtag_engagementsから自分のエンゲージメント取得
    let eng = { post_count: 0, reaction_count: 0 }
    if (user) {
      const { data: engData } = await supabase
        .from('hashtag_engagements')
        .select('post_count, reaction_count')
        .eq('user_id', user.id)
        .eq('tag', normalizedTag)
        .maybeSingle()
      if (engData) eng = engData
    }
    setEngagement(eng)

    console.log('load result:', { fc, selfFollow })

    if ((fc ?? 0) === 0 && !selfFollow) {
      setPhase('owner_screen')
    } else {
      setPhase('normal')
    }
  }

  async function handleBecomeOwner() {
    if (!user) return
    console.log('handleBecomeOwner fired')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('follows') as any).insert({
      follower_id: user.id,
      following_id: user.id,
      type: 'hashtag',
      tag: normalizedTag,
      status: 'accepted'
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('hashtag_engagements') as any).upsert({
      user_id: user.id,
      tag: normalizedTag,
      is_owner: true,
      post_count: 0,
      reaction_count: 0
    }, { onConflict: 'user_id,tag' })

    setPhase('animating')
    setTimeout(() => {
      load()
    }, 2000)
  }

  async function handleFollow() {
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('follows') as any).insert({
      follower_id: user.id,
      following_id: user.id,
      type: 'hashtag',
      tag: normalizedTag,
      status: 'accepted'
    })
    load()
  }

  async function handleUnfollow() {
    if (!user) return
    await supabase.from('follows').delete()
      .eq('follower_id', user.id)
      .eq('type', 'hashtag')
      .eq('tag', normalizedTag)
    load()
  }

  if (phase === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100dvh', background: '#000'
      }}>
        <p style={{ color: '#666', fontSize: 14 }}>読み込み中...</p>
      </div>
    )
  }

  if (phase === 'animating') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100dvh', background: '#000', gap: 20
      }}>
        <div style={{ fontSize: 80 }}>👑</div>
        <p style={{ color: '#f59e0b', fontSize: 22, fontWeight: 800, margin: 0 }}>
          #{displayTag}
        </p>
        <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>
          オーナーになりました！
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
          あなたが最初のオーナーです
        </p>
      </div>
    )
  }

  if (phase === 'owner_screen') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100dvh', background: '#000'
      }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: '#fff',
              fontSize: 22, cursor: 'pointer', padding: '4px 8px',
              lineHeight: 1
            }}
          >
            ←
          </button>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            #{displayTag}
          </span>
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: '0 32px'
        }}>
          <div style={{ fontSize: 64 }}>👑</div>
          <span style={{
            border: '1px solid #fff', borderRadius: 9999,
            padding: '4px 16px', color: '#fff', fontSize: 15
          }}>
            #{displayTag}
          </span>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, textAlign: 'center' }}>
            最初のオーナーになろう
          </p>
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            このタグをフォローして<br />コミュニティの最初のメンバーになれます
          </p>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>0 Following</p>
          <button
            onClick={handleBecomeOwner}
            style={{
              background: 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)',
              color: 'white',
              fontWeight: 700,
              padding: '12px 36px',
              borderRadius: 9999,
              fontSize: 15,
              border: 'none',
              cursor: 'pointer',
              marginTop: 8,
              boxShadow: '0 4px 20px rgba(150,100,255,0.4)'
            }}
          >
            オーナーになる
          </button>
        </div>
      </div>
    )
  }

  // normal
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: '#000', overflow: 'hidden'
    }}>
      <div style={{
        flexShrink: 0, padding: '16px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #222'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: '#fff',
            fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1
          }}
        >
          ←
        </button>
        <button
          onClick={isFollowing ? handleUnfollow : handleFollow}
          style={{
            background: isFollowing ? 'transparent' : '#fff',
            color: isFollowing ? '#fff' : '#000',
            border: isFollowing ? '1px solid #fff' : 'none',
            padding: '7px 20px', borderRadius: 9999,
            fontWeight: 700, fontSize: 13, cursor: 'pointer'
          }}
        >
          {isFollowing ? 'フォロー中' : 'フォロー'}
        </button>
      </div>

      {isFollowing && (
        <div style={{
          display: 'flex',
          padding: '12px 16px',
          borderBottom: '1px solid #222',
          gap: 16,
          alignItems: 'flex-start'
        }}>
          {/* 左：タグ名・フォロワー数 */}
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 4px 0' }}>
              #{displayTag}
            </p>
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
              {followerCount} people following
            </p>
          </div>

          {/* 右：エンゲージメントバー */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
            {/* 投稿バー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>投稿</span>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>
                  {engagement.post_count}/{POST_GOAL}
                </span>
              </div>
              <div style={{ height: 5, background: '#333', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((engagement.post_count / POST_GOAL) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #FF6B6B, #FFD93D)',
                  borderRadius: 9999,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* リアクションバー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>リアクション</span>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>
                  {engagement.reaction_count}/{REACTION_GOAL}
                </span>
              </div>
              <div style={{ height: 5, background: '#333', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((engagement.reaction_count / REACTION_GOAL) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #4D96FF, #9B59B6)',
                  borderRadius: 9999,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* コメント解放表示 */}
            {engagement.post_count >= POST_GOAL && engagement.reaction_count >= REACTION_GOAL && (
              <p style={{ color: '#6BCB77', fontSize: 11, margin: '2px 0 0 0', fontWeight: 600 }}>
                ✓ コメント解放済み
              </p>
            )}
          </div>
        </div>
      )}

      {!isFollowing && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #222' }}>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 4px 0' }}>
            #{displayTag}
          </p>
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
            {followerCount} people following
          </p>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <p style={{ color: '#666', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
          No posts found
        </p>
      </div>
    </div>
  )
}
