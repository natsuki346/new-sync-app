'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SyncLogo from '@/components/SyncLogo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { GENRES, GENRE_HASHTAGS } from '@/lib/genreHashtags';

const RAINBOW = 'linear-gradient(to right, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8)';

// ── スタイル定数 ──────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 24px 48px',
  background: 'var(--bg-primary)',
  minHeight: 0,
  overflowY: 'auto',
};

const skipBtnStyle: React.CSSProperties = {
  marginTop: 16,
  background: 'none',
  border: 'none',
  color: 'var(--text-tertiary)',
  fontSize: 13,
  cursor: 'pointer',
  textDecoration: 'underline',
};

// ── メインコンポーネント ──────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, followHashtag } = useAuth();

  // ── 認証ガード ────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth'); return; }
    if (profile?.onboarding_completed === true) { router.replace('/home'); }
  }, [authLoading, user, profile, router]);

  // STEP 1 state
  const [step,           setStep]           = useState<1 | 2>(1);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [genreError,     setGenreError]     = useState('');

  // STEP 2 state
  const [followedTags, setFollowedTags] = useState<Set<string>>(new Set());
  const [tagSearch,    setTagSearch]    = useState('');
  const [loading,      setLoading]      = useState(false);

  // ── onboarding_completed を true に更新 ─────────────────────
  const markCompleted = async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true } as any)
      .eq('id', user.id);
  };

  // ── スキップ ─────────────────────────────────────────────────
  const handleSkip = async () => {
    await markCompleted();
    router.push('/home');
  };

  // ── STEP 1 ───────────────────────────────────────────────────

  function toggleGenre(label: string) {
    setSelectedGenres(prev => {
      const next = new Set(prev);
      if (next.has(label)) { next.delete(label); } else { next.add(label); }
      return next;
    });
    setGenreError('');
  }

  function handleStep1Submit() {
    if (selectedGenres.size === 0) {
      setGenreError('最低1つ選んでください');
      return;
    }
    const defaultTags = [...selectedGenres].flatMap(g => GENRE_HASHTAGS[g] ?? []);
    setFollowedTags(new Set(defaultTags));
    setStep(2);
  }

  // ── STEP 2 ───────────────────────────────────────────────────

  const allCandidateTags = useMemo(() => {
    const tags = [...selectedGenres].flatMap(g => GENRE_HASHTAGS[g] ?? []);
    return [...new Set(tags)];
  }, [selectedGenres]);

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim();
    if (!q) return allCandidateTags;
    const matched = allCandidateTags.filter(t => t.includes(q));
    if (matched.length === 0) {
      const candidate = q.startsWith('#') ? q : `#${q}`;
      return [candidate];
    }
    return matched;
  }, [allCandidateTags, tagSearch]);

  function toggleTag(tag: string) {
    setFollowedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) { next.delete(tag); } else { next.add(tag); }
      return next;
    });
  }

  async function handleStep2Submit() {
    setLoading(true);
    try {
      await Promise.all([...followedTags].map(tag => followHashtag(tag)));
      await markCompleted();
    } catch (e) {
      console.error('ハッシュタグフォローエラー:', e);
    }
    setLoading(false);
    router.push('/home');
  }

  // ── ガード中のローディング表示 ────────────────────────────────
  if (authLoading || !user) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>読み込み中...</div>
      </div>
    );
  }

  // ── STEP 2 ───────────────────────────────────────────────────

  if (step === 2) {
    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: 24 }}>
          <SyncLogo width={110} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          <div style={{ width: 24, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ width: 24, height: 4, borderRadius: 2, background: RAINBOW }} />
        </div>

        <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>
          ハッシュタグをフォローしよう
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
          興味のあるタグをフォローして、タイムラインをカスタマイズしよう
        </p>

        {/* 検索バー */}
        <div style={{
          width: '100%', maxWidth: 340, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: 12, border: '1px solid rgba(128,128,128,0.2)',
          background: 'var(--surface)', padding: '8px 12px',
          boxSizing: 'border-box',
        }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>🔍</span>
          <input
            type="text"
            value={tagSearch}
            onChange={e => setTagSearch(e.target.value)}
            placeholder="ハッシュタグを検索…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 14,
            }}
          />
          {tagSearch && (
            <button
              onClick={() => setTagSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, lineHeight: 1 }}
            >✕</button>
          )}
        </div>

        {/* タグチップ一覧 */}
        <div style={{
          width: '100%', maxWidth: 340,
          display: 'flex', flexWrap: 'wrap', gap: 8,
          marginBottom: 24,
        }}>
          {filteredTags.map(tag => {
            const isFollowed = followedTags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: isFollowed ? 'none' : '1px solid rgba(128,128,128,0.25)',
                  background: isFollowed ? RAINBOW : 'var(--surface)',
                  color: isFollowed ? '#0d0d1a' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: isFollowed ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* フォロー数 */}
        <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 16 }}>
          {followedTags.size > 0 ? `${followedTags.size}個フォロー中` : 'タグを選んでください'}
        </p>

        {/* 完了ボタン */}
        <button
          type="button"
          onClick={handleStep2Submit}
          disabled={loading}
          style={{
            width: '100%', maxWidth: 340,
            padding: '14px 0', borderRadius: 14, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(128,128,128,0.2)' : RAINBOW,
            color: '#fff', fontSize: 15, fontWeight: 700,
            opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          {loading ? '保存中...' : '完了'}
        </button>

        <button type="button" onClick={handleSkip} style={skipBtnStyle}>
          スキップ
        </button>
      </div>
    );
  }

  // ── STEP 1 ───────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 24 }}>
        <SyncLogo width={110} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <div style={{ width: 24, height: 4, borderRadius: 2, background: RAINBOW }} />
        <div style={{ width: 24, height: 4, borderRadius: 2, background: 'rgba(128,128,128,0.2)' }} />
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>
        好きなジャンルを選ぼう
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4, textAlign: 'center' }}>
        選んだジャンルのタイムラインが表示されます
      </p>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 24, textAlign: 'center' }}>
        あとで変更できます
      </p>

      {/* ジャンルグリッド */}
      <div style={{
        width: '100%', maxWidth: 340,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10, marginBottom: 24,
      }}>
        {GENRES.map(({ label, emoji }) => {
          const isSelected = selectedGenres.has(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggleGenre(label)}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '14px 8px', borderRadius: 14,
                border: isSelected ? '1.5px solid transparent' : '1.5px solid rgba(128,128,128,0.2)',
                background: isSelected ? 'rgba(124,111,232,0.18)' : 'var(--surface)',
                backgroundImage: isSelected ? RAINBOW : 'none',
                backgroundClip: isSelected ? 'padding-box' : 'unset',
                cursor: 'pointer', transition: 'all 0.15s',
                WebkitTapHighlightColor: 'transparent',
                position: 'relative',
                boxShadow: isSelected ? '0 0 12px rgba(124,111,232,0.35)' : 'none',
              }}
            >
              {isSelected && (
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: 14, padding: 1.5,
                  background: RAINBOW,
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  pointerEvents: 'none',
                }} />
              )}
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                lineHeight: 1.3, textAlign: 'center',
              }}>
                {label}
              </span>
              {isSelected && (
                <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4, lineHeight: 1.4, color: 'var(--text-primary)', textAlign: 'center' }}>
                  {GENRE_HASHTAGS[label]?.slice(0, 3).join(' ')}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 選択数 */}
      <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 4 }}>
        {selectedGenres.size > 0 ? `${selectedGenres.size}個選択中` : '選択してください'}
      </p>

      {genreError && (
        <p style={{ color: '#E84040', fontSize: 13, marginBottom: 8 }}>
          {genreError}
        </p>
      )}

      {/* 次へボタン */}
      <button
        type="button"
        onClick={handleStep1Submit}
        disabled={selectedGenres.size === 0}
        style={{
          width: '100%', maxWidth: 340,
          padding: '14px 0', borderRadius: 14, border: 'none',
          cursor: selectedGenres.size === 0 ? 'not-allowed' : 'pointer',
          background: selectedGenres.size === 0 ? 'rgba(128,128,128,0.2)' : RAINBOW,
          color: '#fff', fontSize: 15, fontWeight: 700,
          opacity: selectedGenres.size === 0 ? 0.6 : 1, transition: 'opacity 0.15s',
        }}
      >
        次へ
      </button>

      <button type="button" onClick={handleSkip} style={skipBtnStyle}>
        スキップ
      </button>
    </div>
  );
}
