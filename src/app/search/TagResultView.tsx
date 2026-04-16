'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import PostCard from '@/components/PostCard'
import ReplyModal from '@/components/ReplyModal'
import type { Post } from '@/lib/mockData'

type Phase = 'loading' | 'owner_screen' | 'animating' | 'normal'

type PostRow = {
  id: string
  content: string
  hashtags: string[]
  color: string | null
  created_at: string
  expires_at: string | null
  profiles: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

type Props = {
  tag: string
  onBack: () => void
}

// PostRow → PostCard/ReplyModal が期待する Post 型に変換
function toPost(row: PostRow): Post {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw  = (row as any).profiles
  const prof = Array.isArray(raw) ? raw[0] : raw
  return {
    id:        row.id,
    content:   row.content,
    hashtags:  row.hashtags,
    time:      '',
    isMutual:  false,
    expiresAt: row.expires_at
      ? new Date(row.expires_at).getTime()
      : Date.now() + 72 * 3600 * 1000,
    createdAt: new Date(row.created_at).getTime(),
    name:      prof?.display_name ?? 'Unknown',
    handle:    '@' + (prof?.username ?? 'user'),
    avatar:    prof?.avatar_url ?? '👤',
    lat:       null,
    lng:       null,
  } as Post
}

export default function TagResultView({ tag, onBack }: Props) {
  const { user } = useAuth()
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  const displayTag = normalizedTag.replace(/^#/, '')

  const [phase,            setPhase]            = useState<Phase>('loading')
  const [followerCount,    setFollowerCount]    = useState(0)
  const [isFollowing,      setIsFollowing]      = useState(false)
  const [engagement,       setEngagement]       = useState({ post_count: 0, reaction_count: 0 })
  const [posts,            setPosts]            = useState<PostRow[]>([])
  const [myReactionsMap,   setMyReactionsMap]   = useState<Record<string, string>>({})
  const [reactionCountsMap, setReactionCountsMap] = useState<Record<string, number>>({})
  const [replyPost,        setReplyPost]        = useState<PostRow | null>(null)
  const [replyOpen,        setReplyOpen]        = useState(false)
  const [cardColor,        setCardColor]        = useState('')
  const [hashtagColor,     setHashtagColor]     = useState('')
  const [textColor,        setTextColor]        = useState('')

  const POST_GOAL     = 3
  const REACTION_GOAL = 10

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedTag])

  useEffect(() => {
    setCardColor(localStorage.getItem('sync_card_bg') || '')
    setHashtagColor(localStorage.getItem('sync_hashtag_color') || '')
    setTextColor(localStorage.getItem('sync_text_color') || '')
  }, [])

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

    // postsテーブルから該当ハッシュタグの投稿を取得
    const now = new Date().toISOString()
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, content, hashtags, color, created_at, expires_at, profiles(username, display_name, avatar_url)')
      .contains('hashtags', [normalizedTag])
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(20)
    const resolvedPosts = (postsData as unknown as PostRow[]) ?? []
    setPosts(resolvedPosts)

    // リアクション一括取得
    const postIds = resolvedPosts.map(p => p.id)
    if (postIds.length > 0) {
      const { data: reactionsData } = await supabase
        .from('reactions')
        .select('target_id, user_id, emoji')
        .eq('target_type', 'post')
        .in('target_id', postIds)
      const newMyMap: Record<string, string> = {}
      const newCountMap: Record<string, number> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(reactionsData ?? []).forEach((r: any) => {
        if (r.user_id === user?.id) newMyMap[r.target_id] = r.emoji
        newCountMap[r.target_id] = (newCountMap[r.target_id] ?? 0) + 1
      })
      setMyReactionsMap(newMyMap)
      setReactionCountsMap(newCountMap)
    }

    if ((fc ?? 0) === 0 && !selfFollow) {
      setPhase('owner_screen')
    } else {
      setPhase('normal')
    }
  }

  async function handleReact(postId: string, emoji: string, postHashtags: string[]) {
    if (!user) return

    // UUID検証
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)
    if (!isUUID) {
      console.warn('postId is not UUID, skipping DB:', postId)
      return
    }

    const currentEmoji = myReactionsMap[postId]

    if (currentEmoji === emoji) {
      // 同じ絵文字 → トグルOFF（削除）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('reactions') as any).delete()
        .eq('user_id', user.id)
        .eq('target_id', postId)
        .eq('target_type', 'post')
        .eq('emoji', emoji)
      setMyReactionsMap(prev => { const n = { ...prev }; delete n[postId]; return n })
      setReactionCountsMap(prev => ({
        ...prev,
        [postId]: Math.max((prev[postId] ?? 1) - 1, 0),
      }))
      // エンゲージメントバーをリアルタイム更新（カウントダウン）
      setEngagement(prev => ({
        ...prev,
        reaction_count: Math.max(prev.reaction_count - 1, 0),
      }))
    } else {
      // 新規または別絵文字 → upsert
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('reactions') as any).upsert({
        user_id:     user.id,
        target_id:   postId,
        target_type: 'post',
        emoji,
      }, { onConflict: 'user_id,target_id,emoji' })

      if (!error) {
        const wasReacted = !!currentEmoji
        setMyReactionsMap(prev => ({ ...prev, [postId]: emoji }))
        if (!wasReacted) {
          setReactionCountsMap(prev => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }))
          // エンゲージメントバーをリアルタイム更新（カウントアップ）
          setEngagement(prev => ({
            ...prev,
            reaction_count: prev.reaction_count + 1,
          }))
        }
        for (const tag of postHashtags) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.rpc as any)('increment_hashtag_reaction', { p_user_id: user.id, p_tag: tag })
        }
      } else {
        console.error('reaction upsert error:', error)
      }
    }
  }

  function openReply(post: PostRow) {
    if (!user) return
    const engaged =
      engagement.post_count >= POST_GOAL && engagement.reaction_count >= REACTION_GOAL
    if (!engaged) return
    setReplyPost(post)
    setReplyOpen(true)
  }

  async function handleBecomeOwner() {
    if (!user) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('follows') as any).insert({
      follower_id:  user.id,
      following_id: user.id,
      type:         'hashtag',
      tag:          normalizedTag,
      status:       'accepted',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('hashtag_engagements') as any).upsert({
      user_id:        user.id,
      tag:            normalizedTag,
      is_owner:       true,
      post_count:     0,
      reaction_count: 0,
    }, { onConflict: 'user_id,tag' })

    setPhase('animating')
    setTimeout(() => { load() }, 2000)
  }

  async function handleFollow() {
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('follows') as any).insert({
      follower_id:  user.id,
      following_id: user.id,
      type:         'hashtag',
      tag:          normalizedTag,
      status:       'accepted',
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

  // ── ローディング ──────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100dvh', background: 'var(--bg-primary)',
      }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>読み込み中...</p>
      </div>
    )
  }

  // ── アニメーション ────────────────────────────────────────────────
  if (phase === 'animating') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100dvh', background: 'var(--bg-primary)', gap: 20,
      }}>
        <div style={{ fontSize: 80 }}>👑</div>
        <p style={{ color: '#f59e0b', fontSize: 22, fontWeight: 800, margin: 0 }}>
          #{displayTag}
        </p>
        <p style={{ color: 'var(--foreground)', fontSize: 20, fontWeight: 700, margin: 0 }}>
          オーナーになりました！
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
          あなたが最初のオーナーです
        </p>
      </div>
    )
  }

  // ── オーナー募集画面 ──────────────────────────────────────────────
  if (phase === 'owner_screen') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100dvh', background: 'var(--bg-primary)',
      }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: 'var(--foreground)',
              fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
            }}
          >
            ←
          </button>
          <span style={{ color: 'var(--foreground)', fontWeight: 700, fontSize: 16 }}>
            #{displayTag}
          </span>
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: '0 32px',
        }}>
          <div style={{ fontSize: 64 }}>👑</div>
          <span style={{
            border: '1px solid rgb(var(--border-rgb))', borderRadius: 9999,
            padding: '4px 16px', color: 'var(--foreground)', fontSize: 15,
          }}>
            #{displayTag}
          </span>
          <p style={{ color: 'var(--foreground)', fontSize: 20, fontWeight: 700, margin: 0, textAlign: 'center' }}>
            最初のオーナーになろう
          </p>
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            このタグをフォローして<br />コミュニティの最初のメンバーになれます
          </p>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>0 Following</p>
          <button
            onClick={handleBecomeOwner}
            style={{
              background:  'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)',
              color:       'white',
              fontWeight:  700,
              padding:     '12px 36px',
              borderRadius: 9999,
              fontSize:    15,
              border:      'none',
              cursor:      'pointer',
              marginTop:   8,
              boxShadow:   '0 4px 20px rgba(150,100,255,0.4)',
            }}
          >
            オーナーになる
          </button>
        </div>
      </div>
    )
  }

  // ── ノーマル ──────────────────────────────────────────────────────
  const isEngaged =
    engagement.post_count >= POST_GOAL && engagement.reaction_count >= REACTION_GOAL

  return (
    <div style={{
      position:      'relative',   // ReplyModal の absolute 配置基準
      display:       'flex',
      flexDirection: 'column',
      height:        '100dvh',
      background:    'var(--bg-primary)',
      overflow:      'hidden',
    }}>
      {/* ── ヘッダー */}
      <div style={{
        flexShrink: 0, padding: '16px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgb(var(--border-rgb))',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: 'var(--foreground)',
            fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
          }}
        >
          ←
        </button>
        <button
          onClick={isFollowing ? handleUnfollow : handleFollow}
          style={{
            background: isFollowing ? 'transparent' : 'var(--foreground)',
            color:      isFollowing ? 'var(--foreground)' : 'var(--bg-primary)',
            border:     isFollowing ? '1px solid rgb(var(--border-rgb))' : 'none',
            padding: '7px 20px', borderRadius: 9999,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}
        >
          {isFollowing ? 'フォロー中' : 'フォロー'}
        </button>
      </div>

      {/* ── タグ情報 + エンゲージメントバー（フォロー中） */}
      {isFollowing && (
        <div style={{
          display: 'flex', padding: '12px 16px',
          borderBottom: '1px solid rgb(var(--border-rgb))', gap: 16, alignItems: 'flex-start',
        }}>
          {/* 左：タグ名・フォロワー数 */}
          <div style={{ flex: 1 }}>
            <p style={{ color: textColor || 'var(--foreground)', fontSize: 20, fontWeight: 800, margin: '0 0 4px 0' }}>
              #{displayTag}
            </p>
            <p style={{ color: textColor ? textColor + 'aa' : 'var(--muted)', fontSize: 13, margin: 0 }}>
              {followerCount} people following
            </p>
          </div>

          {/* 右：エンゲージメントバー */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
            {/* 投稿バー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>投稿</span>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                  {engagement.post_count}/{POST_GOAL}
                </span>
              </div>
              <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((engagement.post_count / POST_GOAL) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #FF6B6B, #FFD93D)',
                  borderRadius: 9999, transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* リアクションバー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>リアクション</span>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                  {engagement.reaction_count}/{REACTION_GOAL}
                </span>
              </div>
              <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((engagement.reaction_count / REACTION_GOAL) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #4D96FF, #9B59B6)',
                  borderRadius: 9999, transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* コメント解放表示 */}
            {isEngaged && (
              <p style={{ color: '#6BCB77', fontSize: 11, margin: '2px 0 0 0', fontWeight: 600 }}>
                ✓ コメント解放済み
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── タグ情報（未フォロー） */}
      {!isFollowing && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgb(var(--border-rgb))' }}>
          <p style={{ color: textColor || 'var(--foreground)', fontSize: 20, fontWeight: 800, margin: '0 0 4px 0' }}>
            #{displayTag}
          </p>
          <p style={{ color: textColor ? textColor + 'aa' : 'var(--muted)', fontSize: 13, margin: 0 }}>
            {followerCount} people following
          </p>
        </div>
      )}

      {/* ── 投稿一覧 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        {posts.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
            まだ投稿がありません
          </p>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={toPost(post)}
              onReply={() => openReply(post)}
              onReact={(emoji: string) => handleReact(post.id, emoji, post.hashtags)}
              initialReactedEmoji={myReactionsMap[post.id] ?? null}
              reactionCount={reactionCountsMap[post.id] ?? 0}
              isReplyLocked={!isEngaged}
              isReactionLocked={false}
              cardColor={cardColor || undefined}
              hashtagBorderColor={hashtagColor || undefined}
            />
          ))
        )}
      </div>

      {/* ── 返信モーダル */}
      {replyOpen && replyPost && (
        <ReplyModal
          post={toPost(replyPost)}
          open={replyOpen}
          onClose={() => { setReplyOpen(false); setReplyPost(null) }}
        />
      )}
    </div>
  )
}
