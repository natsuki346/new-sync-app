'use client';

import { useState, useEffect, useRef } from 'react';
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
  const {
    currentCall,
    cancelOutgoingCall,
    isCancellingCall,
    isMuted,
    toggleMute,
    isCameraOff,
    toggleCameraOff,
    localVideoContainerRef,
    startLocalVideo,
    stopLocalVideo,
  } = useCall();
  const { user } = useAuth();

  const [mounted,      setMounted]      = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [imgError,     setImgError]     = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setPortalTarget(document.getElementById('app-root') ?? document.body);
  }, []);
  useEffect(() => { setImgError(false); }, [otherProfile?.id]);

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

  // 発信音のループ再生
  useEffect(() => {
    if (!currentCall || currentCall.status !== 'ringing') {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    const audio = new Audio('/sounds/outgoing-call.mp3');
    audio.loop = true;
    audio.play().catch(() => {}); // 自動再生ブロックやファイル不在は無視
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [currentCall?.id, currentCall?.status]);

  // ビデオ通話: ringing 中にローカルビデオを publish
  // container ref は JSX レンダー後に set されるため setTimeout(0) で待つ
  useEffect(() => {
    if (!mounted) return;
    if (!currentCall) return;
    if (currentCall.call_type !== 'video') return;
    if (currentCall.status !== 'ringing') return;

    const id = setTimeout(() => {
      startLocalVideo().catch((err) => {
        console.error('[OutgoingCallOverlay] startLocalVideo failed:', err);
      });
    }, 0);

    return () => clearTimeout(id);
    // startLocalVideo は依存配列に入れない（useCallback 更新で無限ループになる危険）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, currentCall?.id, currentCall?.call_type, currentCall?.status]);

  // アンマウント時にビデオを停止し、ActiveCallOverlay 側で再 publish させる
  useEffect(() => {
    return () => {
      if (currentCall?.call_type === 'video') {
        stopLocalVideo().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted || !portalTarget || !currentCall || currentCall.status !== 'ringing') return null;

  const displayName = otherProfile?.display_name ?? '呼び出し中';

  async function handleCancel() {
    try {
      await cancelOutgoingCall();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? 'キャンセルに失敗しました');
    }
  }

  async function handleToggleMute() {
    try {
      await toggleMute();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? 'ミュート操作に失敗しました');
    }
  }

  async function handleToggleCameraOff() {
    try {
      await toggleCameraOff();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? 'カメラ操作に失敗しました');
    }
  }

  // =====================================================
  // ビデオ発信中レイアウト
  // =====================================================

  if (currentCall.call_type === 'video') {
    return createPortal(
      <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">

        {/* 中央: avatar + 名前 + 呼び出し中 */}
        <div className="flex flex-col items-center">
          {otherProfile?.avatar_url && !imgError ? (
            <img
              src={otherProfile.avatar_url}
              alt={displayName}
              onError={() => setImgError(true)}
              className="w-32 h-32 rounded-full object-cover ring-4 ring-white/10 mb-6"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-zinc-700 ring-4 ring-white/10 mb-6 flex items-center justify-center text-5xl">
              👤
            </div>
          )}
          <h2 className="text-3xl font-semibold text-white mb-2">{displayName}</h2>
          <p className="text-lg text-gray-400 mb-1">呼び出し中...</p>
          <p className="text-xs text-gray-500">ビデオ通話</p>
        </div>

        {/* 自分ビデオ: 右上小窓 */}
        <div className="absolute top-4 right-4 w-32 h-44 rounded-lg overflow-hidden ring-2 ring-white/20 shadow-2xl bg-black">
          <div
            ref={localVideoContainerRef}
            className={`w-full h-full ${isCameraOff ? 'invisible' : ''}`}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
              カメラOFF
            </div>
          )}
          <button
            onClick={() => { console.log('[OutgoingCallOverlay] カメラ反転 TODO'); }}
            aria-label="カメラ反転"
            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/50 text-white text-sm flex items-center justify-center"
          >
            🔄
          </button>
        </div>

        {/* 下部ボタン4つ */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6">

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

          {/* 終了（cancelOutgoingCall） */}
          <button
            onClick={handleCancel}
            disabled={isCancellingCall}
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

          {/* カメラOFF */}
          <button
            onClick={handleToggleCameraOff}
            aria-label="カメラOFF"
            className={`w-16 h-16 rounded-full flex items-center justify-center transition active:scale-95 ${
              isCameraOff ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <span className="text-2xl">{isCameraOff ? '📷' : '🎥'}</span>
          </button>

        </div>
      </div>,
      portalTarget
    );
  }

  // =====================================================
  // 音声発信中レイアウト
  // =====================================================

  return createPortal(
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center">

      {/* avatar */}
      {otherProfile?.avatar_url && !imgError ? (
        <img
          src={otherProfile.avatar_url}
          alt={displayName}
          onError={() => setImgError(true)}
          className="w-32 h-32 rounded-full object-cover ring-4 ring-white/10 mb-6"
        />
      ) : (
        <div className="w-32 h-32 rounded-full bg-zinc-700 ring-4 ring-white/10 mb-6 flex items-center justify-center text-5xl">
          👤
        </div>
      )}

      {/* 相手名 */}
      <h2 className="text-3xl font-semibold text-white mb-2">{displayName}</h2>

      {/* ステータス */}
      <p className="text-lg text-gray-400 mb-16">呼び出し中...</p>

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
          onClick={handleCancel}
          disabled={isCancellingCall}
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
    portalTarget
  );
}
