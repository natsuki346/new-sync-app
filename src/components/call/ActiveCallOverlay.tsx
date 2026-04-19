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
  const {
    currentCall,
    callClient,
    endCall,
    isEndingCall,
    isMuted,
    toggleMute,
    isCameraOff,
    toggleCameraOff,
    localVideoContainerRef,
    remoteVideoContainerRef,
    startLocalVideo,
  } = useCall();
  const { user } = useAuth();

  const [mounted,      setMounted]      = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [elapsed,      setElapsed]      = useState(0);
  const [imgError,     setImgError]     = useState(false);

  // SSR 回避
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

  // ビデオ通話: リモートユーザーの映像を描画する
  useEffect(() => {
    if (!mounted) return;
    if (!currentCall) return;
    if (currentCall.call_type !== 'video') return;
    if (currentCall.status !== 'ongoing') return;
    if (!callClient) return;

    const container = remoteVideoContainerRef.current;
    if (!container) return;

    // user-published(video) を受け取ったら renderRemoteVideo
    const handlePublished = (uid: number, mediaType: 'audio' | 'video') => {
      if (mediaType !== 'video') return;
      callClient.renderRemoteVideo(uid, container).catch((err) => {
        console.error('[ActiveCallOverlay] renderRemoteVideo failed:', err);
      });
    };

    // 後発 join の場合: 既に映像を publish しているリモートユーザーを即座に描画
    for (const remote of callClient.getRemoteUsers()) {
      if (remote.hasVideo) {
        callClient.renderRemoteVideo(remote.uid, container).catch((err) => {
          console.error('[ActiveCallOverlay] initial renderRemoteVideo failed:', err);
        });
      }
    }

    callClient.on('user-published', handlePublished);

    return () => {
      callClient.off('user-published', handlePublished);
    };
  }, [mounted, currentCall?.id, currentCall?.call_type, currentCall?.status, callClient]);

  // ビデオ通話: ongoing になったら localVideo を publish
  // container ref は JSX レンダー後に set されるため setTimeout(0) で待つ
  useEffect(() => {
    if (!mounted) return;
    if (!currentCall) return;
    if (currentCall.call_type !== 'video') return;
    if (currentCall.status !== 'ongoing') return;

    const id = setTimeout(() => {
      startLocalVideo().catch((err) => {
        console.error('[ActiveCallOverlay] startLocalVideo failed:', err);
      });
    }, 0);

    return () => clearTimeout(id);
    // startLocalVideo は依存配列に入れない（useCallback 更新で無限ループになる危険）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, currentCall?.id, currentCall?.call_type, currentCall?.status]);

  if (!mounted || !portalTarget || !currentCall || currentCall.status !== 'ongoing') return null;

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

  async function handleToggleCameraOff() {
    try {
      await toggleCameraOff();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) ?? 'カメラ操作に失敗しました');
    }
  }

  // =====================================================
  // ビデオ通話レイアウト
  // =====================================================

  if (currentCall.call_type === 'video') {
    return createPortal(
      <div className="absolute inset-0 z-50 bg-black">

        {/* 相手ビデオ: 全画面 */}
        <div
          ref={remoteVideoContainerRef}
          className="absolute inset-0 bg-black"
        />

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
          {/* カメラ反転ボタン */}
          <button
            onClick={() => { console.log('[ActiveCallOverlay] カメラ反転 TODO'); }}
            aria-label="カメラ反転"
            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/50 text-white text-sm flex items-center justify-center"
          >
            🔄
          </button>
        </div>

        {/* 上部: 相手名 + 通話時間 */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full text-white text-sm">
          <span>{otherName}</span>
          <span className="tabular-nums text-gray-300">{formattedDuration}</span>
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

          {/* 終了 */}
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
  // 音声通話レイアウト
  // =====================================================

  return createPortal(
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center">

      {/* 相手 avatar */}
      {otherProfile?.avatar_url && !imgError ? (
        <img
          src={otherProfile.avatar_url}
          alt={otherName}
          onError={() => setImgError(true)}
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
    portalTarget
  );
}
