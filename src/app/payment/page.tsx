'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// ── 型定義 ────────────────────────────────────────────────────────

type PaymentType = 'paypay' | 'card' | 'convenience';

interface CardEntry {
  id: string;
  brand: 'VISA' | 'Mastercard' | 'JCB';
  last4: string;
  expiry: string;
  holder: string;
}

// ── モックデータ ─────────────────────────────────────────────────

const INITIAL_CARDS: CardEntry[] = [
  { id: 'c1', brand: 'VISA',       last4: '4242', expiry: '12/27', holder: 'TARO YAMADA' },
  { id: 'c2', brand: 'Mastercard', last4: '8888', expiry: '03/26', holder: 'TARO YAMADA' },
];

// ── 定数 ─────────────────────────────────────────────────────────

const BRAND_COLOR: Record<string, string> = {
  VISA:       '#1A1F71',
  Mastercard: '#EB001B',
  JCB:        '#007B40',
};

const CONVENIENCE_STORES = ['Lawson', 'FamilyMart', '7-Eleven'];

// ── カードブランドアイコン ─────────────────────────────────────

function BrandBadge({ brand }: { brand: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
      color: '#fff', background: BRAND_COLOR[brand] ?? '#555',
      padding: '2px 5px', borderRadius: 4,
    }}>
      {brand}
    </span>
  );
}

// ── デフォルトカード大表示 ────────────────────────────────────

function DefaultCard({ defaultType, cards }: { defaultType: PaymentType; cards: CardEntry[] }) {
  const card = cards[0];

  const bgMap: Record<PaymentType, string> = {
    paypay:      'linear-gradient(135deg, #FF0033 0%, #CC0029 100%)',
    card:        'linear-gradient(135deg, #1A1F71 0%, #0D1240 100%)',
    convenience: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
  };
  const iconMap: Record<PaymentType, string> = { paypay: '💰', card: '💳', convenience: '🏪' };
  const labelMap: Record<PaymentType, string> = {
    paypay:      'PayPay',
    card:        card ? `${card.brand} ****${card.last4}` : 'Credit Card',
    convenience: 'Convenience Store',
  };
  const subMap: Record<PaymentType, string> = {
    paypay:      'Pay with PayPay app',
    card:        card ? `Expires ${card.expiry}` : 'No card registered',
    convenience: 'Lawson · FamilyMart · 7-Eleven',
  };

  return (
    <div style={{
      background: bgMap[defaultType], borderRadius: 16,
      padding: '20px 20px 18px', color: '#fff',
      position: 'relative', overflow: 'hidden', marginBottom: 24,
    }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', bottom: -20, right: 20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E63946', borderRadius: 20, padding: '3px 10px', marginBottom: 16, fontSize: 10, fontWeight: 700 }}>
        <span>★</span><span>Default</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 28 }}>{iconMap[defaultType]}</span>
        <div>
          <p style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>{labelMap[defaultType]}</p>
          <p style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{subMap[defaultType]}</p>
        </div>
      </div>
    </div>
  );
}

// ── カード追加フォーム ────────────────────────────────────────

function AddCardForm({ onAdd, onCancel }: {
  onAdd: (card: Omit<CardEntry, 'id'>) => void;
  onCancel: () => void;
}) {
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv,    setCvv]    = useState('');
  const [holder, setHolder] = useState('');

  function detectBrand(num: string): 'VISA' | 'Mastercard' | 'JCB' {
    if (num.startsWith('4')) return 'VISA';
    if (num.startsWith('5') || num.startsWith('2')) return 'Mastercard';
    return 'JCB';
  }
  function formatNumber(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  }
  function formatExpiry(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  }

  const digits = number.replace(/\s/g, '');
  const isValid = digits.length === 16 && expiry.length === 5 && cvv.length >= 3 && holder.trim().length > 0;

  function handleSubmit() {
    if (!isValid) return;
    onAdd({ brand: detectBrand(digits), last4: digits.slice(-4), expiry, holder: holder.toUpperCase() });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    border: '1.5px solid var(--surface-2)', borderRadius: 10,
    fontSize: 15, outline: 'none',
    background: 'var(--surface)', color: 'var(--foreground)',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>Card Number</label>
        <input type="text" inputMode="numeric" placeholder="1234 5678 9012 3456"
          value={number} onChange={(e) => setNumber(formatNumber(e.target.value))} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Expiry Date</label>
          <input type="text" inputMode="numeric" placeholder="MM/YY"
            value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>CVV</label>
          <input type="text" inputMode="numeric" placeholder="123"
            value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Cardholder Name (Roman letters)</label>
        <input type="text" placeholder="TARO YAMADA"
          value={holder} onChange={(e) => setHolder(e.target.value)}
          style={{ ...inputStyle, textTransform: 'uppercase' }} />
      </div>
      <button
        onClick={handleSubmit} disabled={!isValid}
        style={{
          width: '100%', padding: '14px',
          background: isValid ? '#E63946' : 'var(--surface-2)',
          color: isValid ? '#fff' : 'var(--muted)',
          border: 'none', borderRadius: 12,
          fontWeight: 700, fontSize: 15, cursor: isValid ? 'pointer' : 'default', marginTop: 4,
        }}
      >
        Add Card
      </button>
      <button onClick={onCancel}
        style={{ width: '100%', padding: '12px', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  );
}

// ── 支払い方法追加ボトムシート ────────────────────────────────

type SheetStep = 'select' | 'card-form';

function AddPaymentSheet({ onClose, onAddCard }: {
  onClose: () => void;
  onAddCard: (card: Omit<CardEntry, 'id'>) => void;
}) {
  const [step, setStep] = useState<SheetStep>('select');

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px', paddingBottom: 80,
          maxHeight: '85%', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--surface-2)', margin: '0 auto 20px' }} />

        {step === 'select' && (
          <>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--foreground)', marginBottom: 16 }}>
              Select Payment Method
            </p>
            {[
              { icon: '💰', label: 'PayPay',             sub: 'Pay with PayPay app',           color: '#FF0033' },
              { icon: '💳', label: 'Credit Card',        sub: 'VISA / Mastercard / JCB',       color: '#1A1F71' },
              { icon: '🏪', label: 'Convenience Store', sub: 'Lawson · FamilyMart · 7-Eleven', color: '#2563EB' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { if (item.label === 'Credit Card') setStep('card-form'); else onClose(); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 12px', borderRadius: 12,
                  border: '1.5px solid var(--surface-2)',
                  background: 'var(--surface)', cursor: 'pointer', marginBottom: 10, textAlign: 'left',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: item.color + '28',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.sub}</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--surface-2)" strokeWidth={2} style={{ width: 16, height: 16, flexShrink: 0 }}>
                  <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </>
        )}

        {step === 'card-form' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <button onClick={() => setStep('select')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth={2} style={{ width: 20, height: 20 }}>
                  <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--foreground)' }}>Add Credit Card</p>
            </div>
            <AddCardForm
              onAdd={(card) => { onAddCard(card); onClose(); }}
              onCancel={() => setStep('select')}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── メインページ ─────────────────────────────────────────────────

export default function PaymentPage() {
  const router = useRouter();
  const [defaultType, setDefaultType] = useState<PaymentType>('paypay');
  const [cards,       setCards]       = useState<CardEntry[]>(INITIAL_CARDS);
  const [showSheet,   setShowSheet]   = useState(false);

  function addCard(card: Omit<CardEntry, 'id'>) {
    setCards((prev) => [...prev, { ...card, id: `c${Date.now()}` }]);
  }

  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    borderBottom: '1px solid var(--surface-2)',
    background: 'var(--surface)',
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--background)', position: 'relative', overflow: 'hidden' }}>

      {/* ── ヘッダー ── */}
      <header
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 14px), 14px)',
          paddingBottom: 12,
          borderBottom: '1px solid var(--surface-2)',
          background: 'var(--background)',
        }}
      >
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ background: 'var(--surface-2)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5" style={{ color: 'var(--foreground)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-base font-black" style={{ color: 'var(--foreground)' }}>Payment Methods</h1>
      </header>

      {/* ── スクロールエリア ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>

        <DefaultCard defaultType={defaultType} cards={cards} />

        {/* ── PayPay ── */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>PayPay</p>
          <div style={{ borderRadius: 14, border: '1px solid var(--surface-2)', overflow: 'hidden' }}>
            <div style={rowBase}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FF003328', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💰</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>PayPay</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Pay with PayPay app</p>
              </div>
              {defaultType === 'paypay' ? (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#E63946', color: '#fff' }}>Default</span>
              ) : (
                <button onClick={() => setDefaultType('paypay')} style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 20, border: '1.5px solid #E63946', background: 'transparent', color: '#E63946', cursor: 'pointer' }}>
                  Set as Default
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── クレジットカード ── */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>Credit Card</p>
          <div style={{ borderRadius: 14, border: '1px solid var(--surface-2)', overflow: 'hidden' }}>
            {cards.map((card, i) => (
              <div key={card.id} style={{ ...rowBase, borderBottom: i < cards.length - 1 ? '1px solid var(--surface-2)' : 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#1A1F7128', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💳</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <BrandBadge brand={card.brand} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>****{card.last4}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>Expires {card.expiry} · {card.holder}</p>
                </div>
                {defaultType === 'card' && i === 0 ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#E63946', color: '#fff' }}>Default</span>
                ) : (
                  <button onClick={() => setDefaultType('card')} style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 20, border: '1.5px solid #E63946', background: 'transparent', color: '#E63946', cursor: 'pointer' }}>
                    Set as Default
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setShowSheet(true)}
              style={{ ...rowBase, borderBottom: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, border: '2px dashed var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--muted)', flexShrink: 0 }}>＋</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Add Card</span>
            </button>
          </div>
        </div>

        {/* ── コンビニ払い ── */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>Convenience Store</p>
          <div style={{ borderRadius: 14, border: '1px solid var(--surface-2)', overflow: 'hidden' }}>
            <div style={rowBase}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563EB28', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏪</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>Convenience Store</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{CONVENIENCE_STORES.join('・')}</p>
              </div>
              {defaultType === 'convenience' ? (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#E63946', color: '#fff' }}>Default</span>
              ) : (
                <button onClick={() => setDefaultType('convenience')} style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 20, border: '1.5px solid #E63946', background: 'transparent', color: '#E63946', cursor: 'pointer' }}>
                  Set as Default
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSheet(true)}
          style={{
            width: '100%', padding: '14px',
            border: '2px dashed var(--surface-2)',
            borderRadius: 14, background: 'transparent',
            color: '#E63946', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>＋</span>
          Add New Payment Method
        </button>

      </div>

      {showSheet && (
        <AddPaymentSheet onClose={() => setShowSheet(false)} onAddCard={addCard} />
      )}
    </div>
  );
}
