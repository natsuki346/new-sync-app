'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SyncLogo from '@/components/SyncLogo';
import { useAuth } from '@/contexts/AuthContext';

const RAINBOW = 'linear-gradient(to right, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8)';

const GENRES = [
  { label: '音楽',       tag: '#音楽',       emoji: '🎵' },
  { label: 'スポーツ',   tag: '#スポーツ',   emoji: '⚽' },
  { label: 'アニメ',     tag: '#アニメ',     emoji: '🎌' },
  { label: 'マンガ',     tag: '#マンガ',     emoji: '📚' },
  { label: 'ゲーム',     tag: '#ゲーム',     emoji: '🎮' },
  { label: 'グルメ',     tag: '#グルメ',     emoji: '🍜' },
  { label: 'ファッション', tag: '#ファッション', emoji: '👗' },
  { label: '映画',       tag: '#映画',       emoji: '🎬' },
  { label: 'ドラマ',     tag: '#ドラマ',     emoji: '📺' },
  { label: 'テクノロジー', tag: '#テクノロジー', emoji: '💻' },
  { label: 'アウトドア', tag: '#アウトドア', emoji: '🏕️' },
  { label: '勉強・資格', tag: '#勉強',       emoji: '📝' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { followHashtag } = useAuth();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  function toggleGenre(tag: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
    setError('');
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      setError('最低1つ選んでください');
      return;
    }
    setLoading(true);
    try {
      await Promise.all([...selected].map(tag => followHashtag(tag)));
    } catch (e) {
      console.error('ハッシュタグフォローエラー:', e);
    }
    setLoading(false);
    router.push('/home');
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 24px 48px',
      background: 'var(--bg-primary)',
      minHeight: 0,
      overflowY: 'auto',
    }}>
      {/* ロゴ */}
      <div style={{ marginBottom: 28 }}>
        <SyncLogo width={110} />
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>
        好きなジャンルを選ぼう
      </h1>
      <p style={{ color: 'rgba(128,128,128,0.8)', fontSize: 13, marginBottom: 4, textAlign: 'center' }}>
        選んだジャンルのタイムラインが表示されます
      </p>
      <p style={{ color: 'rgba(128,128,128,0.5)', fontSize: 11, marginBottom: 28, textAlign: 'center' }}>
        あとで変更できます
      </p>

      {/* ジャンルグリッド */}
      <div style={{
        width: '100%',
        maxWidth: 340,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 24,
      }}>
        {GENRES.map(({ label, tag, emoji }) => {
          const isSelected = selected.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleGenre(tag)}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            4,
                padding:        '14px 8px',
                borderRadius:   14,
                border:         isSelected ? '1.5px solid transparent' : '1.5px solid rgba(255,255,255,0.12)',
                background:     isSelected ? 'rgba(124,111,232,0.18)' : 'rgba(255,255,255,0.05)',
                backgroundImage: isSelected ? RAINBOW : 'none',
                backgroundClip: isSelected ? 'padding-box' : 'unset',
                cursor:         'pointer',
                transition:     'all 0.15s',
                WebkitTapHighlightColor: 'transparent',
                position:       'relative',
                boxShadow:      isSelected ? '0 0 12px rgba(124,111,232,0.35)' : 'none',
              }}
            >
              {/* 選択時のレインボーボーダー */}
              {isSelected && (
                <span style={{
                  position:     'absolute',
                  inset:        0,
                  borderRadius: 14,
                  padding:      1.5,
                  background:   RAINBOW,
                  WebkitMask:   'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  pointerEvents: 'none',
                }} />
              )}
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span style={{
                fontSize:   11,
                fontWeight: 600,
                color:      isSelected ? '#fff' : 'rgba(255,255,255,0.65)',
                lineHeight: 1.3,
                textAlign:  'center',
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 選択数 */}
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 }}>
        {selected.size > 0 ? `${selected.size}個選択中` : '選択してください'}
      </p>

      {/* エラー */}
      {error && (
        <p style={{ color: '#E84040', fontSize: 13, marginBottom: 8 }}>
          {error}
        </p>
      )}

      {/* 決定ボタン */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || selected.size === 0}
        style={{
          width:        '100%',
          maxWidth:     340,
          padding:      '14px 0',
          borderRadius: 14,
          border:       'none',
          cursor:       (loading || selected.size === 0) ? 'not-allowed' : 'pointer',
          background:   (loading || selected.size === 0) ? 'rgba(255,255,255,0.10)' : RAINBOW,
          color:        '#fff',
          fontSize:     15,
          fontWeight:   700,
          opacity:      (loading || selected.size === 0) ? 0.6 : 1,
          transition:   'opacity 0.15s',
        }}
      >
        {loading ? '保存中...' : 'はじめる'}
      </button>

      {/* スキップ */}
      <button
        type="button"
        onClick={() => router.push('/home')}
        style={{
          marginTop:      16,
          background:     'none',
          border:         'none',
          color:          'rgba(255,255,255,0.35)',
          fontSize:       13,
          cursor:         'pointer',
          textDecoration: 'underline',
        }}
      >
        スキップ
      </button>
    </div>
  );
}
