'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import SyncLogo from '@/components/SyncLogo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const RAINBOW = 'linear-gradient(to right, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8)';
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function UsernamePage() {
  const t = useTranslations('username');
  const router = useRouter();
  const { user } = useAuth();

  const [username,  setUsername]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [checking,  setChecking]  = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // リアルタイムバリデーション
  useEffect(() => {
    setAvailable(null);
    if (!username) return;
    if (!USERNAME_RE.test(username)) return;

    const timer = setTimeout(async () => {
      setChecking(true);
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      setChecking(false);
      setAvailable(data === null);
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  function getValidationMessage(): { text: string; color: string } | null {
    if (!username) return null;
    if (username.length < 3) return { text: t('tooShort'), color: '#E84040' };
    if (username.length > 20) return { text: t('tooLong'), color: '#E84040' };
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return { text: t('invalidChars'), color: '#E84040' };
    if (checking) return { text: t('checking'), color: 'rgba(128,128,128,0.6)' };
    if (available === true) return { text: t('available'), color: '#48C468' };
    if (available === false) return { text: t('taken'), color: '#E84040' };
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!USERNAME_RE.test(username)) {
      setError(t('invalidChars'));
      return;
    }
    if (!available) {
      setError(t('taken'));
      return;
    }

    setLoading(true);
    setError('');

    if (!user) {
      setLoading(false);
      setError(t('authError'));
      return;
    }

    const { error: insertError } = await (supabase as any).from('profiles').upsert({
      id: user.id,
      username,
      display_name: username,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message ?? t('saveFailed'));
    } else {
      sessionStorage.removeItem('sync_phone');
      await new Promise(resolve => setTimeout(resolve, 500));
      router.push('/home');
    }
  }

  const validation = getValidationMessage();
  const canSubmit = USERNAME_RE.test(username) && available === true && !loading && !checking;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 24px 48px',
      background: 'var(--bg-primary)',
      minHeight: 0,
      overflowY: 'auto',
    }}>
      <div style={{ marginBottom: 36 }}>
        <SyncLogo width={130} />
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
        {t('title')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 28, textAlign: 'center' }}>
        {t('hint')}
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: 12,
          border: '1px solid var(--border-color)',
          background: 'rgba(128,128,128,0.1)',
          overflow: 'hidden',
        }}>
          <span style={{
            padding: '0 12px',
            color: 'var(--text-secondary)',
            fontSize: 16,
            fontWeight: 600,
            userSelect: 'none',
          }}>@</span>
          <input
            type="text"
            placeholder={t('placeholder')}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            autoComplete="username"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{
              flex: 1,
              padding: '12px 14px 12px 0',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 16,
              outline: 'none',
            }}
          />
        </div>

        {validation && (
          <p style={{ color: validation.color, fontSize: 12, margin: 0, paddingLeft: 4 }}>
            {validation.text}
          </p>
        )}

        {error && (
          <p style={{ color: '#E84040', fontSize: 13, textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            marginTop: 8,
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit ? RAINBOW : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            opacity: canSubmit ? 1 : 0.5,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? t('saving') : t('start')}
        </button>
      </form>
    </div>
  );
}
