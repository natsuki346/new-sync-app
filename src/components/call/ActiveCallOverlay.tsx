'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCall } from '@/contexts/CallContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function ActiveCallOverlay() {
  const { currentCall, endCall, isEndingCall, isMuted, toggleMute } = useCall();
  const { user } = useAuth();

  const [mounted,      setMounted]      = useState(false);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [elapsed,      setElapsed]      = useState(0);

  // SSR 回避
  useEffect(() => { setMounted(true); }, []);

  // 相手プロフィール取得
  useEffect(() => {
    if (!currentCall || !user?.id) {
      setOtherProfile(null);
      return;
    }

    const callId = currentCall.id;
    const selfId = user.id;

    async function fetchOther() {
      const { data: partRows } = await (supabase as any)
        .from('call_participants')
        .select('user_id')
        .eq('call_id', callId);

      const userIds = ((partRows ?? []) as { user_id: string }[]).map(
        (p) => p.user_id
      );
      const otherIds = userIds.filter((id) => id !== selfId);
      if (otherIds.length === 0) return;

      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', otherIds[0])
        .maybeSingle();

      setOtherProfile(prof as Profile | null);
    }

    fetchOther();
  }, [currentCall?.id, user?.id]);

  // 通話時間カウントアップ
  useEffect(() => {
    if (!currentCall) {
      setElapsed(0);
      return;
    }

    const base = currentCall.answered_at ?? currentCall.started_at;
    const startMs = new Date(base).getTime();

    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [currentCall?.id, currentCall?.answered_at, currentCall?.started_at]);

  if (!mounted || !currentCall || currentCall.status !== 'ongoing') return null;

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  const formattedDuration = `${minutes}:${seconds}`;

  const otherName = otherProfile?.display_name ?? '通話中';

  async function handleEnd() {
    try {
      await endCall();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? '切断に失敗しました');
    }
  }

  async function handleToggleMute() {
    try {
      await toggleMute();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? 'ミュート操作に失敗しました');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center">

      {/* 相手 avatar */}
      {otherProfile?.avatar_url ? (
        <img
          src={otherProfile.avatar_url}
          alt={otherName}
          className="w-32 h-32 rounded-full object-cover ring-4 ring-white/10 mb-6"
        />
      ) : (
        <div className="w-32 h-32 rounded-full bg-zinc-700 ring-4 ring-white/10 mb-6 flex items-center justify-center text-5xl">
          👤
        </div>
      )}

      {/* 相手名 */}
      <h2 className="text-3xl font-semibold text-white mb-2">{otherName}</h2>

      {/* 通話時間 */}
      <p className="text-lg text-gray-400 mb-16 tabular-nums">{formattedDuration}</p>

      {/* コントロール3ボタン */}
      <div className="flex items-center justify-center gap-10">
        {/* ミュート */}
        <button
          onClick={handleToggleMute}
          aria-label="ミュート"
          className={`w-16 h-16 rounded-full flex items-center justify-center transition active:scale-95 ${
            isMuted ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <span className="text-2xl">{isMuted ? '🔇' : '🎤'}</span>
        </button>

        {/* 終了（赤・大きめ） */}
        <button
          onClick={handleEnd}
          disabled={isEndingCall}
          aria-label="終了"
          className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition flex items-center justify-center shadow-2xl disabled:opacity-50"
        >
          <span className="text-white text-3xl">✕</span>
        </button>

        {/* スピーカー（UIのみ） */}
        <button
          aria-label="スピーカー"
          className="w-16 h-16 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition active:scale-95"
        >
          <span className="text-2xl">🔊</span>
        </button>
      </div>

      {/* ボタンラベル */}
      <div className="flex items-center justify-center gap-10 mt-3 text-xs text-gray-400">
        <span className="w-16 text-center">ミュート</span>
        <span className="w-20 text-center">終了</span>
        <span className="w-16 text-center">スピーカー</span>
      </div>

    </div>,
    document.body
  );
}
