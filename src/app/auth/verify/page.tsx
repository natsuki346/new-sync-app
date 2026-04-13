'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import SyncLogo from '@/components/SyncLogo';
import { supabase } from '@/lib/supabase';

const RAINBOW = 'linear-gradient(to right, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8)';
const OTP_LEN = 6;

export default function VerifyPage() {
  const t = useTranslations('auth');

  const [digits,  setDigits]  = useState<string[]>(Array(OTP_LEN).fill(''));
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [resent,  setResent]  = useState(false);
  const [phone,   setPhone]   = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem('sync_phone');
    if (!stored) {
      window.location.href = '/auth';
      return;
    }
    setPhone(stored);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  function handleChange(index: number, value: string) {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < OTP_LEN - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, OTP_LEN);
    if (!pasted) return;
    const next = [...Array(OTP_LEN).fill('')];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LEN - 1);
    inputRefs.current[focusIdx]?.focus();
  }

  async function submitCode(code: string) {
    if (!phone) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    setLoading(false);
    if (error) {
      setError(error.message);
      setDigits(Array(OTP_LEN).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } else {
      window.location.href = '/auth/username';
    }
  }

  async function handleResend() {
    if (!phone || resent) return;
    await supabase.auth.signInWithOtp({ phone });
    setResent(true);
    setError('');
    setTimeout(() => setResent(false), 30000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== OTP_LEN) {
      setError(t('codeRequired'));
      return;
    }
    await submitCode(code);
  }

  const maskedPhone = phone
    ? phone.slice(0, Math.max(phone.length - 4, 4)) + '****'
    : '';

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
        {t('verify')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 36, textAlign: 'center' }}>
        {maskedPhone} {t('verifySub')}
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', gap: 10 }} onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              style={{
                width: 44,
                height: 54,
                borderRadius: 12,
                border: d
                  ? '1.5px solid rgba(124,111,232,0.7)'
                  : '1px solid var(--border-color)',
                background: 'rgba(128,128,128,0.1)',
                color: 'var(--text-primary)',
                fontSize: 22,
                fontWeight: 700,
                textAlign: 'center',
                outline: 'none',
                caretColor: '#7C6FE8',
                transition: 'border-color 0.15s',
              }}
            />
          ))}
        </div>

        {error && (
          <p style={{ color: '#E84040', fontSize: 13, textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || digits.join('').length !== OTP_LEN}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            cursor: (loading || digits.join('').length !== OTP_LEN) ? 'not-allowed' : 'pointer',
            background: (loading || digits.join('').length !== OTP_LEN) ? 'rgba(255,255,255,0.1)' : RAINBOW,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            opacity: (loading || digits.join('').length !== OTP_LEN) ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? t('confirming') : t('confirm')}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resent}
          style={{
            background: 'none',
            border: 'none',
            cursor: resent ? 'default' : 'pointer',
            color: resent ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)',
            fontSize: 13,
            textDecoration: resent ? 'none' : 'underline',
            padding: 0,
          }}
        >
          {resent ? t('resent') : t('resend')}
        </button>
      </form>
    </div>
  );
}
