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

export default function OutgoingCallOverlay() {
  const { currentCall, endCall, isEndingCall } = useCall();
  const { user } = useAuth();
  const [mounted,         setMounted]         = useState(false);
  const [otherProfile,    setOtherProfile]    = useState<Profile | null>(null);
  const [otherCount,      setOtherCount]      = useState(0);

  useEffect(() => { setMounted(true); }, []);

  // 相手プロフィール取得
  useEffect(() => {
    if (!currentCall || !user?.id) {
      setOtherProfile(null);
      setOtherCount(0);
      return;
    }

    const callId = currentCall.id;
    const selfId = user.id;

    async function fetchOther() {
      // 参加者の user_id 一覧
      const { data: partRows } = await (supabase as any)
        .from('call_participants')
        .select('user_id')
        .eq('call_id', callId);

      const userIds = ((partRows ?? []) as { user_id: string }[]).map(
        (p) => p.user_id
      );
      const otherIds = userIds.filter((id) => id !== selfId);
      setOtherCount(otherIds.length);

      if (otherIds.length === 0) return;

      // 1on1: 相手1人のプロフィールを取得
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', otherIds[0])
        .maybeSingle();

      setOtherProfile(prof as Profile | null);
    }

    fetchOther();
  }, [currentCall?.id, user?.id]);

  if (!mounted || !currentCall || currentCall.status !== 'ringing') return null;

  const callTypeLabel = currentCall.call_type === 'video' ? 'ビデオ通話' : '音声通話';
  const isGroup = otherCount > 1;

  const displayName = isGroup
    ? `グループ通話 (他${otherCount}人)`
    : (otherProfile?.display_name ?? '...');

  async function handleCancel() {
    try {
      await endCall();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? 'キャンセルに失敗しました');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[90%] max-w-sm rounded-2xl bg-zinc-900 shadow-2xl p-6 flex flex-col items-center">

        {/* Avatar */}
        <div className="relative mb-4">
          {otherProfile?.avatar_url ? (
            <img
              src={otherProfile.avatar_url}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-zinc-800"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-zinc-700 ring-4 ring-zinc-800 flex items-center justify-center text-4xl">
              👤
            </div>
          )}
        </div>

        {/* 相手名 */}
        <h2 className="text-2xl font-semibold text-white mb-1">
          {displayName}
        </h2>

        {/* サブテキスト */}
        <p className="text-sm text-gray-400 mb-1">呼び出し中...</p>
        <p className="text-xs text-gray-500 mb-8">
          {callTypeLabel}
        </p>

        {/* キャンセルボタン（中央・円形） */}
        <div className="flex items-center justify-center mt-4">
          <button
            onClick={handleCancel}
            disabled={isEndingCall}
            aria-label="キャンセル"
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition flex items-center justify-center shadow-lg disabled:opacity-50"
          >
            <span className="text-white text-2xl">✕</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
