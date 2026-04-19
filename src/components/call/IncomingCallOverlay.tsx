'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCall } from '@/contexts/CallContext';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function IncomingCallOverlay() {
  const {
    incomingCall,
    acceptCall,
    rejectCall,
    isAcceptingCall,
    isRejectingCall,
  } = useCall();

  const [mounted,       setMounted]       = useState(false);
  const [callerProfile, setCallerProfile] = useState<Profile | null>(null);
  const [participants,  setParticipants]  = useState<Profile[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // 発信者プロフィール + 参加者一覧を取得
  useEffect(() => {
    if (!incomingCall) {
      setCallerProfile(null);
      setParticipants([]);
      return;
    }

    const callId      = incomingCall.id;
    const initiatedBy = incomingCall.initiated_by;

    async function fetchData() {
      // 発信者プロフィール
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', initiatedBy)
        .maybeSingle();
      setCallerProfile(prof as Profile | null);

      // 参加者の user_id 一覧
      const { data: partRows } = await (supabase as any)
        .from('call_participants')
        .select('user_id')
        .eq('call_id', callId);

      const userIds = ((partRows ?? []) as { user_id: string }[]).map(
        (p) => p.user_id
      );

      if (userIds.length === 0) return;

      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      setParticipants((profiles ?? []) as Profile[]);
    }

    fetchData();
  }, [incomingCall?.id, incomingCall?.initiated_by]);

  // 着信音のループ再生
  useEffect(() => {
    if (!incomingCall) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    const audio = new Audio('/sounds/incoming-call.mp3');
    audio.loop = true;
    audio.play().catch(() => {}); // 自動再生ブロックは無視
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [incomingCall?.id]);

  if (!mounted || !incomingCall) return null;

  const isGroup    = participants.length > 2;
  const isBusy     = isAcceptingCall || isRejectingCall;
  const callTypeLabel = incomingCall.call_type === 'video' ? 'ビデオ通話' : '音声通話';

  async function handleAccept() {
    try {
      await acceptCall();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? '応答に失敗しました');
    }
  }

  async function handleReject() {
    try {
      await rejectCall();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? '拒否に失敗しました');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[90%] max-w-sm rounded-2xl bg-zinc-900 shadow-2xl p-6 flex flex-col items-center">

        {/* Avatar */}
        <div className="relative mb-4">
          {callerProfile?.avatar_url ? (
            <img
              src={callerProfile.avatar_url}
              alt={callerProfile.display_name ?? ''}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-zinc-800"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-zinc-700 ring-4 ring-zinc-800 flex items-center justify-center text-4xl">
              👤
            </div>
          )}
        </div>

        {/* 名前 */}
        <h2 className="text-2xl font-semibold text-white mb-1">
          {isGroup ? 'グループ通話' : (callerProfile?.display_name ?? 'Unknown')}
        </h2>

        {/* サブテキスト */}
        <p className="text-sm text-gray-400 mb-1">着信中...</p>
        <p className="text-xs text-gray-500 mb-4">
          {incomingCall.call_type === 'video' ? 'ビデオ通話' : '音声通話'}
        </p>

        {/* グループ参加者リスト */}
        {isGroup && (
          <p className="text-xs text-gray-500 mb-4 text-center">
            参加者: {participants.map((p) => p.display_name ?? '?').join(', ')}
          </p>
        )}

        {/* ボタン横並び */}
        <div className="flex items-center justify-center gap-12 mt-4">
          {/* 拒否ボタン */}
          <button
            onClick={handleReject}
            disabled={isBusy}
            aria-label="拒否"
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition flex items-center justify-center shadow-lg disabled:opacity-50"
          >
            <span className="text-white text-2xl">✕</span>
          </button>

          {/* 応答ボタン */}
          <button
            onClick={handleAccept}
            disabled={isBusy}
            aria-label="応答"
            className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 active:scale-95 transition flex items-center justify-center shadow-lg disabled:opacity-50"
          >
            <span className="text-white text-2xl">☎</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
