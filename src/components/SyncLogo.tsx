'use client'
import { useEffect, useState } from 'react'

export default function SyncLogo({ width = 120 }: { width?: number }) {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const gradId = dark ? 'sync-gd' : 'sync-gl'
  const stops = dark ? [
    { offset: '0%',   color: '#7C6FE8' },
    { offset: '18%',  color: '#D455A8' },
    { offset: '36%',  color: '#E84040' },
    { offset: '52%',  color: '#E8A020' },
    { offset: '68%',  color: '#48C468' },
    { offset: '84%',  color: '#2890D8' },
    { offset: '100%', color: '#7C6FE8' },
  ] : [
    { offset: '0%',   color: '#5A50CC' },
    { offset: '18%',  color: '#C03090' },
    { offset: '36%',  color: '#D02828' },
    { offset: '52%',  color: '#C07C10' },
    { offset: '68%',  color: '#28A048' },
    { offset: '84%',  color: '#1070C0' },
    { offset: '100%', color: '#5A50CC' },
  ]

  const shineId = `shine-${dark ? 'd' : 'l'}`
  const maskId  = `mask-${dark ? 'd' : 'l'}`

  return (
    <svg viewBox="0 0 560 155" xmlns="http://www.w3.org/2000/svg" width={width} height={width * 155 / 560}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
        <linearGradient id={shineId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity={dark ? 0.55 : 0.40} />
          <stop offset="38%"  stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId}>
          <text x="280" y="126" textAnchor="middle"
            fontFamily="'Arial Black','Impact',sans-serif"
            fontSize="140" fontWeight="900" letterSpacing="-2" fill="white">SYNC.</text>
        </mask>
      </defs>
      <rect x="0" y="0" width="560" height="155"
        fill={`url(#${gradId})`}
        mask={`url(#${maskId})`} />
      <rect x="0" y="0" width="560" height="155"
        fill={`url(#${shineId})`}
        mask={`url(#${maskId})`} />
    </svg>
  )
}
