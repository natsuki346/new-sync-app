'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Post } from '@/lib/mockData'

// ── バブルアニメーション（home/page.tsx と同じロジック） ──────────
function spawnSheetBubbles(container: HTMLElement): void {
  if (typeof window === 'undefined') return
  const hour = new Date().getHours()
  const colors =
    hour >= 5  && hour < 10 ? ['rgba(255,180,100,0.9)', 'rgba(255,150,80,0.8)',  'rgba(255,200,120,0.9)'] :
    hour >= 10 && hour < 17 ? ['rgba(100,180,255,0.9)', 'rgba(80,200,255,0.8)',  'rgba(150,220,255,0.9)'] :
    hour >= 17 && hour < 20 ? ['rgba(255,100,100,0.9)', 'rgba(255,120,80,0.8)',  'rgba(255,80,150,0.9)']  :
                               ['rgba(150,80,255,0.9)',  'rgba(100,120,255,0.8)', 'rgba(180,80,255,0.9)']
  const w = container.offsetWidth
  const h = container.offsetHeight
  if (w <= 0 || h <= 0) return
  const count = 60 + Math.floor(Math.random() * 21)
  Array.from({ length: count }, (_, i) => {
    const el     = document.createElement('div')
    el.className = 'tiny-bubble'
    const large  = i % 3 === 0
    const size   = large ? 12 + Math.random() * 8 : 4 + Math.random() * 4
    const x      = (i / count) * w + (Math.random() - 0.5) * (w / count)
    const delay  = Math.random() * 800
    const dur    = 0.8 + Math.random() * 1.0
    const tx     = (Math.random() - 0.5) * 160
    const ty     = -(Math.random() * 50 + 40)
    const startY = h * 0.5 + Math.random() * h * 0.5
    el.style.width                   = `${size}px`
    el.style.height                  = `${size}px`
    el.style.left                    = `${x}px`
    el.style.top                     = `${startY}px`
    el.style.background              = colors[i % colors.length]
    el.style.setProperty('--tx', `${tx}px`)
    el.style.setProperty('--ty', `${ty}px`)
    el.style.animationName           = 'bubbleBlast'
    el.style.animationDuration       = `${dur}s`
    el.style.animationDelay          = `${delay}ms`
    el.style.animationFillMode       = 'forwards'
    el.style.animationTimingFunction = 'ease-out'
    container.appendChild(el)
    setTimeout(() => el.parentNode?.removeChild(el), 3000)
  })
}

// ── 返信アイテム型 ─────────────────────────────────────────────────
type ReplyItem = {
  id:         string
  content:    string
  created_at: string
  profile: {
    username:     string
    display_name: string
    avatar_url:   string | null
  } | null
}

// ── ReplyModal ─────────────────────────────────────────────────────
export default function ReplyModal({
  post,
  open = true,
  onClose,
  onReplied,
}: {
  post:       Post | null
  open?:      boolean
  onClose:    () => void
  onReplied?: () => void
}) {
  const t = useTranslations('home')
  const { user, profile } = useAuth()
  const [text,           setText]           = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [replies,        setReplies]        = useState<ReplyItem[]>([])
  const [repliesLoading, setRepliesLoading] = useState(false)
  const textaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const hashtagColor = typeof window !== 'undefined'
    ? localStorage.getItem('sync_hashtag_color') || ''
    : ''

  useEffect(() => {
    if (open && modalRef.current) spawnSheetBubbles(modalRef.current)
    if (open) setTimeout(() => textaRef.current?.focus(), 120)
  }, [open])

  // キープ: アニメーション中も最後の投稿を表示
  const lastPost = useRef<Post | null>(null)
  if (post) lastPost.current = post
  const displayPost = post ?? lastPost.current

  // 既存の返信を取得
  useEffect(() => {
    if (!open || !displayPost) return
    setRepliesLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from('posts') as any)
      .select(`
        id, content, created_at,
        profile:profiles!posts_user_id_fkey (
          username, display_name, avatar_url
        )
      `)
      .eq('parent_id', displayPost.id)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: ReplyItem[] | null }) => {
        setReplies(data ?? [])
        setRepliesLoading(false)
      })
  // displayPost.id が変わった（別投稿を開いた）時だけ再取得
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, displayPost?.id])

  async function handlePost() {
    if (!text.trim() || !user || !displayPost || submitting) return
    setSubmitting(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('posts') as any).insert({
      user_id:    user.id,
      content:    text.trim(),
      parent_id:  displayPost.id,
      hashtags:   [],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })

    if (error) {
      console.error('返信保存エラー:', error)
    } else {
      setText('')
      onClose()
      onReplied?.()
    }
    setSubmitting(false)
  }

  return (
    <div
      ref={modalRef}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        background:    'var(--background)',
        transform:     open ? 'translateY(0)' : 'translateY(100%)',
        transition:    open ? 'transform 0.25s ease-out' : 'transform 0.28s ease-in',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* ── ヘッダー ── */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--surface-2)' }}
      >
        <button
          className="text-sm font-medium active:opacity-60 transition-opacity"
          style={{ color: 'var(--foreground)' }}
          onClick={() => { setText(''); onClose() }}
        >
          {t('cancel')}
        </button>
        <button
          onClick={handlePost}
          disabled={!text.trim() || submitting}
          className="px-5 py-1.5 rounded-full text-sm font-bold transition-colors"
          style={{
            background: text.trim() && !submitting ? 'var(--brand)' : 'rgba(255,26,26,0.25)',
            color:      text.trim() && !submitting ? '#ffffff'      : 'rgba(255,26,26,0.5)',
          }}
        >
          {submitting ? '送信中…' : t('reply')}
        </button>
      </div>

      {/* ── 本文エリア ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {displayPost && (
          <>
            {/* 元投稿 */}
            <div className="flex gap-3 mb-0">
              {/* 左: アバター + スレッド線 */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}
                >
                  {displayPost.avatar}
                </div>
                <div
                  className="flex-1 rounded-full mt-1.5"
                  style={{ width: 2, minHeight: 28, background: 'var(--surface-2)' }}
                />
              </div>
              {/* 右: 投稿内容 */}
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                    {displayPost.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {displayPost.handle}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {displayPost.content}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {displayPost.hashtags.map((tag) => (
                    <span key={tag} style={hashtagColor ? {
                      background:   'transparent',
                      border:       `1.5px solid ${hashtagColor}`,
                      color:        '#ffffff',
                      padding:      '2px 10px',
                      borderRadius: 9999,
                      fontSize:     12,
                      fontWeight:   600,
                      display:      'inline-block',
                    } : {
                      background:   'linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(90deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF,#9B59B6) border-box',
                      border:       '1.5px solid transparent',
                      color:        '#ffffff',
                      padding:      '2px 10px',
                      borderRadius: 9999,
                      fontSize:     12,
                      fontWeight:   600,
                      display:      'inline-block',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 既存の返信一覧 */}
            {repliesLoading ? (
              <p className="text-xs py-3 pl-12" style={{ color: 'var(--muted)' }}>読み込み中…</p>
            ) : replies.length > 0 && (
              <div className="mb-2">
                {replies.map((r) => (
                  <div key={r.id} className="flex gap-3 py-2">
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        {r.profile?.avatar_url ?? '👤'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                          {r.profile?.display_name ?? ''}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                          @{r.profile?.username ?? ''}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {r.content}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="my-2" style={{ borderTop: '1px solid var(--surface-2)' }} />
              </div>
            )}

            {/* リプライ入力行 */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}
                >
                  {profile?.avatar_url ?? '✨'}
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-2">
                <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                  Replying to{' '}
                  <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{displayPost.handle}</span>
                </p>
                <textarea
                  ref={textaRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  placeholder={t('replyPlaceholder')}
                  rows={4}
                  className="w-full resize-none outline-none text-sm leading-relaxed"
                  style={{
                    background:  'transparent',
                    color:       'var(--foreground)',
                    caretColor:  'var(--brand)',
                    border:      'none',
                    fontFamily:  'inherit',
                    overflow:    'hidden',
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
