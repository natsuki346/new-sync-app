'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import SyncLogo from '@/components/SyncLogo';
import { supabase } from '@/lib/supabase';

const RAINBOW = 'linear-gradient(to right, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8)';

const COUNTRIES = [
  { flag: '🇯🇵', code: '+81',  label: 'JP' },
  { flag: '🇺🇸', code: '+1',   label: 'US' },
  { flag: '🇰🇷', code: '+82',  label: 'KR' },
  { flag: '🇨🇳', code: '+86',  label: 'CN' },
  { flag: '🇬🇧', code: '+44',  label: 'GB' },
  { flag: '🇦🇺', code: '+61',  label: 'AU' },
  { flag: '🇩🇪', code: '+49',  label: 'DE' },
  { flag: '🇫🇷', code: '+33',  label: 'FR' },
  { flag: '🇧🇷', code: '+55',  label: 'BR' },
  { flag: '🇮🇳', code: '+91',  label: 'IN' },
];

export default function AuthPage() {
  const t = useTranslations('auth');
  const router = useRouter();

  const [country,    setCountry]   = useState(COUNTRIES[0]);
  const [phone,      setPhone]     = useState('');
  const [error,      setError]     = useState('');
  const [loading,    setLoading]   = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError(t('phoneRequired'));
      return;
    }
    setLoading(true);
    const fullPhone = country.code + phone.replace(/^0/, '');
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      sessionStorage.setItem('sync_phone', fullPhone);
      window.location.href = '/auth/verify';
    }
  }

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
      <p style={{ color: 'rgba(128,128,128,0.8)', fontSize: 13, marginBottom: 28, textAlign: 'center' }}>
        {t('subtitle')}
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 国番号 + 電話番号 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* 国番号セレクター */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              style={{
                height: '100%',
                padding: '0 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 15,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 20 }}>{country.flag}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{country.code}</span>
            </button>

            {showPicker && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 100,
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                minWidth: 140,
              }}>
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code + c.label}
                    type="button"
                    onClick={() => { setCountry(c); setShowPicker(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 14px',
                      border: 'none',
                      background: c.code === country.code && c.label === country.label ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{c.flag}</span>
                    <span>{c.code}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 電話番号入力 */}
          <input
            type="tel"
            placeholder={t('phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
            autoComplete="tel-national"
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'rgba(128,128,128,0.1)',
              color: 'var(--text-primary)',
              fontSize: 16,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <p style={{ color: '#E84040', fontSize: 13, textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 4,
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(255,255,255,0.1)' : RAINBOW,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? t('sending') : t('sendCode')}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button
          onClick={() => { window.location.href = '/demo'; }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          デモとして見る →
        </button>
      </div>
    </div>
  );
}
