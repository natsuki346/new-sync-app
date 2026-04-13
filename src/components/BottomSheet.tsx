'use client';

import { useEffect } from 'react';

interface BottomSheetProps {
  open:     boolean;
  onClose:  () => void;
  children: React.ReactNode;
}

/**
 * 下からスライドアップするボトムシート。
 * search/[id]/page.tsx の PaymentModal と同じアニメーション・構造。
 * position: fixed なので、どの stacking context からでも最前面に表示される。
 */
export default function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  // シートが開いている間は背面スクロールをロック
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* 暗いオーバーレイ */}
      <div
        style={{
          position: 'fixed', inset: 0,
          zIndex: 300,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* シート本体 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: '100%', maxWidth: 390,
          zIndex: 301,
          background: '#181818',
          borderRadius: '16px 16px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          animation: 'bottomSheetSlideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ハンドルバー */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {children}
      </div>

      <style>{`
        @keyframes bottomSheetSlideUp {
          from { transform: translateX(-50%) translateY(100%); }
          to   { transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}
