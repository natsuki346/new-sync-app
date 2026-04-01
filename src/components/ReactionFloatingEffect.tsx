'use client'

import { useEffect, useState } from 'react'

interface ReactionFloatingEffectProps {
  isActive: boolean
  onBurst?: (x: number, y: number) => void
  triggerCount?: number
}

const MOCK_REACTORS = [
  { id: '1', name: 'yuki', avatar: '🌸' },
  { id: '2', name: 'kai',  avatar: '🔥' },
  { id: '3', name: 'hana', avatar: '🌙' },
  { id: '4', name: 'ren',  avatar: '⚡' },
  { id: '5', name: 'sora', avatar: '💫' },
]

const REACTION_EMOJIS = ['❤️', '🔥', '😭', '✨', '🫶', '😂', '💯', '🙌']

interface FloatingItem {
  id: string
  emoji: string
  reactor: typeof MOCK_REACTORS[number]
  x: number
  duration: number
  delay: number
}

export default function ReactionFloatingEffect({
  isActive,
  onBurst,
  triggerCount,
}: ReactionFloatingEffectProps) {
  const [items, setItems] = useState<FloatingItem[]>([])

  // triggerCount が増えるたびにシミュレーション発動
  useEffect(() => {
    if (!triggerCount || triggerCount === 0) return

    const startDelay  = 1000 + Math.random() * 2000
    const totalCount  = 3 + Math.floor(Math.random() * 4)
    const timeouts: ReturnType<typeof setTimeout>[] = []

    for (let i = 0; i < totalCount; i++) {
      const delay    = startDelay + Math.random() * 8000
      const t = setTimeout(() => {
        const reactor  = MOCK_REACTORS[Math.floor(Math.random() * MOCK_REACTORS.length)]
        const emoji    = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)]
        const x        = 5 + Math.random() * 75
        const duration = 20

        const newItem: FloatingItem = {
          id: `${Date.now()}-${i}`,
          emoji,
          reactor,
          x,
          duration,
          delay: 0,
        }
        setItems(prev => [...prev, newItem])

        // 20秒後に破裂して削除
        setTimeout(() => {
          if (onBurst) {
            const screenX = (x / 100) * window.innerWidth
            const screenY = window.innerHeight * 0.08
            onBurst(screenX, screenY)
          }
          setItems(prev => prev.filter(item => item.id !== newItem.id))
        }, duration * 1000 + 300)
      }, delay)
      timeouts.push(t)
    }

    return () => timeouts.forEach(clearTimeout)
  }, [triggerCount]) // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) return null

  return (
    <div style={{
      position:      'absolute',
      top:           60,
      left:          0,
      right:         0,
      bottom:        0,
      pointerEvents: 'none',
      overflow:      'hidden',
      zIndex:        5,
    }}>
      {items.map(item => (
        <div
          key={item.id}
          style={{
            position:      'absolute',
            bottom:        80,
            left:          `${item.x}%`,
            pointerEvents: 'none',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           2,
            animation:     `floatUp ${item.duration}s ease-out forwards`,
          }}
        >
          {/* 絵文字 */}
          <span style={{ fontSize: 22, lineHeight: 1 }}>{item.emoji}</span>

          {/* ユーザーアイコン＋名前 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width:          20,
              height:         20,
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, #FF1A1A, #8B0000)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       12,
              lineHeight:     1,
            }}>
              {item.reactor.avatar}
            </div>
            <span style={{
              fontSize:   9,
              color:      'rgba(255,255,255,0.7)',
              whiteSpace: 'nowrap',
            }}>
              {item.reactor.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
