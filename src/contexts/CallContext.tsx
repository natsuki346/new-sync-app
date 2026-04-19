'use client';

/**
 * CallContext — 通話のグローバル状態管理
 *
 * 役割:
 *   1. Realtime 購読：自分宛ての着信を検知（call_participants の INSERT を user_id で監視）
 *   2. 発信処理：calls + call_participants INSERT → generate-agora-token 呼び出し → Agora join
 *   3. 通話状態（currentCall / incomingCall / callClient）をグローバルに保持
 *
 * 制約:
 *   - 'use client' なので Client Component 配下でのみ使える
 *   - createCallClient() は window 参照するため useEffect 内でのみ呼び出す
 *
 * 今後の拡張ポイント（フェーズD以降）:
 *   - acceptCall / rejectCall / endCall の実装
 *   - 通話中UI（ミュート/カメラON/OFF）
 *   - 通話終了時の duration 計算と calls.ended_at 更新
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { createCallClient } from '@/lib/agora';
import type { CallClient } from '@/lib/agora';
import type { Call, CallType } from '@/types/call';

// =====================================================
// 型定義
// =====================================================

interface StartCallParams {
  /** どの会話で発信するか */
  conversationId: string;
  /** 呼び出す相手の user_id リスト（自分を含まない） */
  calleeUserIds: string[];
  /** 音声通話か映像通話か */
  callType: CallType;
}

interface CallContextType {
  /** 自分が参加中の通話（発信完了後に set） */
  currentCall: Call | null;

  /** 着信中（まだ応答していない）の通話 */
  incomingCall: Call | null;

  /** Agora クライアント（通話中のみ非 null） */
  callClient: CallClient | null;

  /** 発信する */
  startCall: (params: StartCallParams) => Promise<void>;

  /** 発信中のローディング状態（ボタンの多重押下防止用） */
  isStartingCall: boolean;

  /** 着信に応答する */
  acceptCall: (call?: Call) => Promise<void>;

  /** 応答処理中フラグ（多重押し防止） */
  isAcceptingCall: boolean;

  /** 着信を拒否する */
  rejectCall: (call?: Call) => Promise<void>;

  /** 拒否処理中フラグ（多重押し防止） */
  isRejectingCall: boolean;

  /** 通話を切断する */
  endCall: () => Promise<void>;

  /** 切断処理中フラグ（多重押し防止） */
  isEndingCall: boolean;

  /** 発信をキャンセルする（ringing 中の発信者専用） */
  cancelOutgoingCall: () => Promise<void>;

  /** キャンセル処理中フラグ（多重押し防止） */
  isCancellingCall: boolean;

  /** マイクミュート状態 */
  isMuted: boolean;

  /** マイクミュートをトグルする */
  toggleMute: () => Promise<void>;

  /** カメラOFF状態 */
  isCameraOff: boolean;

  /** カメラON/OFF切替 */
  toggleCameraOff: () => Promise<void>;

  /** 自分のビデオ描画先 ref */
  localVideoContainerRef: React.MutableRefObject<HTMLDivElement | null>;

  /** 相手のビデオ描画先 ref */
  remoteVideoContainerRef: React.MutableRefObject<HTMLDivElement | null>;

  /** ローカルカメラを publishVideo する */
  startLocalVideo: () => Promise<void>;

  /** ローカルカメラを unpublishVideo する */
  stopLocalVideo: () => Promise<void>;

  /**
   * 着信情報をクリアする（DB を触らずUIだけ閉じる。タイムアウト等で使う）
   */
  dismissIncomingCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

// =====================================================
// Edge Function 呼び出しヘルパー
// =====================================================

interface AgoraTokenResponse {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
  expiresAt: number;
}

async function fetchAgoraToken(callId: string): Promise<AgoraTokenResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  const res = await fetch(
    `${supabaseUrl}/functions/v1/generate-agora-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ callId }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `generate-agora-token failed: ${res.status} ${errText}`
    );
  }

  return (await res.json()) as AgoraTokenResponse;
}

// =====================================================
// CallProvider
// =====================================================

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [callClient, setCallClient] = useState<CallClient | null>(null);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [isAcceptingCall, setIsAcceptingCall] = useState(false);
  const [isRejectingCall, setIsRejectingCall] = useState(false);
  const [isEndingCall,      setIsEndingCall]      = useState(false);
  const [isCancellingCall,  setIsCancellingCall]  = useState(false);
  const [isMuted,           setIsMuted]           = useState(false);
  const [isCameraOff,       setIsCameraOff]       = useState(false);

  const localVideoContainerRef  = useRef<HTMLDivElement | null>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement | null>(null);

  // 自分が発信した call の id をローカルに覚えておき、
  // Realtime で自分の call_participants INSERT が飛んできたときに
  // 「これは自分の発信だから着信扱いしない」と判定する
  const selfInitiatedCallIdsRef = useRef<Set<string>>(new Set());

  // =====================================================
  // Realtime 購読：自分宛ての着信を検知
  // =====================================================
  useEffect(() => {
    if (!user?.id) return;

    // call_participants に自分の行が INSERT されたら、その call の情報を取りに行く
    // → initiated_by が自分なら無視、そうでなければ incomingCall に set
    const channel = (supabase as any)
      .channel(`call-incoming-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_participants',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const participantRow = payload.new;
          const callId: string = participantRow.call_id;

          // 自分が発信した call はスキップ（startCall 側でマーク済み）
          if (selfInitiatedCallIdsRef.current.has(callId)) {
            return;
          }

          // call 本体を取得して着信情報を組み立てる
          const { data: callRow, error } = await (supabase as any)
            .from('calls')
            .select('*')
            .eq('id', callId)
            .maybeSingle();

          if (error) {
            console.error('[CallContext] call fetch error:', error);
            return;
          }
          if (!callRow) return;

          // 念のためダブルチェック：initiated_by が自分なら無視
          if (callRow.initiated_by === user.id) return;

          // ringing 以外（すでに終わった等）は無視
          if (callRow.status !== 'ringing') return;

          console.log('[CallContext] incoming call detected:', callRow);
          setIncomingCall(callRow as Call);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // =====================================================
  // Realtime 購読：currentCall の status 変化を検知（ringing → ongoing 等）
  // =====================================================
  useEffect(() => {
    if (!currentCall?.id) return;

    const callId = currentCall.id;
    const channel = (supabase as any)
      .channel(`call-status-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${callId}`,
        },
        (payload: any) => {
          setCurrentCall((prev) => {
            if (!prev || prev.id !== callId) return prev;
            return { ...prev, ...payload.new } as Call;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCall?.id]);

  // =====================================================
  // 発信処理
  // =====================================================
  const startCall = useCallback(
    async (params: StartCallParams) => {
      if (!user?.id) {
        throw new Error('Not authenticated');
      }
      if (params.calleeUserIds.length === 0) {
        throw new Error('No callees specified');
      }

      setIsStartingCall(true);

      // channel_name を先に決める（一意であればよい。crypto.randomUUID() を活用）
      const channelName = `call-${crypto.randomUUID()}`;

      let insertedCallId: string | null = null;
      let client: CallClient | null = null;

      try {
        // ---- 1. calls に INSERT ----
        const { data: callRow, error: callErr } = await (
          supabase.from('calls') as any
        )
          .insert({
            conversation_id: params.conversationId,
            call_type: params.callType,
            channel_name: channelName,
            initiated_by: user.id,
            status: 'ringing',
          })
          .select('*')
          .maybeSingle();

        if (callErr || !callRow) {
          throw new Error(
            `calls insert failed: ${callErr?.message ?? 'unknown'}`
          );
        }

        insertedCallId = callRow.id as string;

        // 自分の発信であることをマーク（Realtime 受信時の自己除外用）
        selfInitiatedCallIdsRef.current.add(insertedCallId);

        // ---- 2. call_participants に自分＋相手を一括 INSERT ----
        // 自分は即座に Agora join するので 'joined' 扱い
        // 相手は 'invited'（応答待ち）
        const participantsPayload = [
          {
            call_id: insertedCallId,
            user_id: user.id,
            status: 'joined',
            joined_at: new Date().toISOString(),
          },
          ...params.calleeUserIds.map((uid) => ({
            call_id: insertedCallId!,
            user_id: uid,
            status: 'invited',
          })),
        ];

        const { error: partErr } = await (
          supabase.from('call_participants') as any
        ).insert(participantsPayload);

        if (partErr) {
          throw new Error(
            `call_participants insert failed: ${partErr.message}`
          );
        }

        // ---- 3. Edge Function で Agora token 取得 ----
        const tokenRes = await fetchAgoraToken(insertedCallId);

        // ---- 4. Agora クライアント生成 → join → publishAudio ----
        client = await createCallClient();
        await client.join({
          appId: tokenRes.appId,
          channelName: tokenRes.channelName,
          token: tokenRes.token,
          uid: tokenRes.uid,
        });
        await client.publishAudio();

        // 映像通話ならこの後 publishVideo も呼ぶが、
        // container 要素が必要なので通話中UI（フェーズE）で実装する

        // ---- 5. state 確定 ----
        setCurrentCall(callRow as Call);
        setCallClient(client);

        console.log('[CallContext] call started:', callRow);
      } catch (err) {
        console.error('[CallContext] startCall failed:', err);

        // ---- ロールバック処理 ----
        // Agora クライアントが生成済みなら leave
        if (client) {
          try {
            await client.leave();
          } catch (leaveErr) {
            console.error('[CallContext] leave on rollback failed:', leaveErr);
          }
        }

        // calls が INSERT 済みなら ended にマーク
        if (insertedCallId) {
          await (supabase.from('calls') as any)
            .update({ status: 'failed', ended_at: new Date().toISOString() })
            .eq('id', insertedCallId);

          // マーキング解除
          selfInitiatedCallIdsRef.current.delete(insertedCallId);
        }

        throw err;
      } finally {
        setIsStartingCall(false);
      }
    },
    [user?.id]
  );

  // =====================================================
  // 着信応答
  // =====================================================
  const acceptCall = useCallback(
    async (call?: Call) => {
      const target = call ?? incomingCall;
      if (!target) return;
      if (!user?.id) throw new Error('Not authenticated');

      setIsAcceptingCall(true);
      let client: CallClient | null = null;

      try {
        // ---- 1. Agora トークン取得 ----
        const tokenRes = await fetchAgoraToken(target.id);

        // ---- 2. Agora join → publishAudio（映像通話ならさらに publishVideo） ----
        client = await createCallClient();
        await client.join({
          appId: tokenRes.appId,
          channelName: tokenRes.channelName,
          token: tokenRes.token,
          uid: tokenRes.uid,
        });
        await client.publishAudio();

        // publishVideo は通話中UI(フェーズE)が container 要素を用意してから呼ぶ。
        // ここでは call_type を記録しておくだけで実際の映像公開は行わない。

        // ---- 3. Agora join 成功後に DB UPDATE ----
        const now = new Date().toISOString();

        const { error: partErr } = await (supabase.from('call_participants') as any)
          .update({ status: 'joined', joined_at: now })
          .eq('call_id', target.id)
          .eq('user_id', user.id)
          .eq('status', 'invited'); // 楽観制御：既に joined 等なら更新されない

        if (partErr) {
          // DB UPDATE 失敗 → Agora を leave してから throw
          await client.leave().catch((leaveErr) => {
            console.error('[CallContext] leave on acceptCall DB error:', leaveErr);
          });
          throw new Error(`call_participants update failed: ${partErr.message}`);
        }

        // calls.status の 'ringing' → 'ongoing' は DB トリガーが自動で行う

        // ---- 4. state 確定 ----
        // Realtime 購読で自分の call_participants UPDATE が飛んでくる可能性があるため
        // 自己除外マークに追加（startCall と同じパターン）
        selfInitiatedCallIdsRef.current.add(target.id);

        setCurrentCall(target);
        setCallClient(client);
        setIncomingCall(null);

        console.log('[CallContext] acceptCall succeeded:', target.id);
      } catch (err) {
        console.error('[CallContext] acceptCall failed:', err);
        throw err;
      } finally {
        setIsAcceptingCall(false);
      }
    },
    [user?.id, incomingCall]
  );

  // =====================================================
  // 着信拒否
  // =====================================================
  const rejectCall = useCallback(
    async (call?: Call) => {
      const target = call ?? incomingCall;
      if (!target) return;
      if (!user?.id) throw new Error('Not authenticated');

      setIsRejectingCall(true);

      try {
        const { error: partErr } = await (supabase.from('call_participants') as any)
          .update({ status: 'declined' })
          .eq('call_id', target.id)
          .eq('user_id', user.id)
          .eq('status', 'invited'); // 楽観制御：既に declined 等なら更新されない

        if (partErr) {
          throw new Error(`call_participants update failed: ${partErr.message}`);
        }

        // 全員 declined による calls.status → 'declined' の集約は DB トリガーが行う

        setIncomingCall(null);

        console.log('[CallContext] rejectCall succeeded:', target.id);
      } catch (err) {
        console.error('[CallContext] rejectCall failed:', err);
        throw err;
      } finally {
        setIsRejectingCall(false);
      }
    },
    [user?.id, incomingCall]
  );

  // =====================================================
  // 通話切断
  // =====================================================
  const endCall = useCallback(async () => {
    if (!currentCall) return;
    if (!user?.id) throw new Error('Not authenticated');

    setIsEndingCall(true);

    const target     = currentCall;
    const clientSnap = callClient;

    try {
      // ---- 1. Agora leave（失敗してもログだけ出して続行） ----
      if (clientSnap) {
        await clientSnap.leave().catch((err) => {
          console.error('[CallContext] endCall leave failed:', err);
        });
      }

      // ---- 2a. call_participants: 自分の row を left に UPDATE ----
      const { error: partErr } = await (supabase.from('call_participants') as any)
        .update({ status: 'left', left_at: new Date().toISOString() })
        .eq('call_id', target.id)
        .eq('user_id', user.id);

      if (partErr) {
        console.error('[CallContext] endCall participants update failed:', partErr);
      }

      // ---- 2b. calls: ended にマーク ----
      // duration_seconds は DB の generated column が自動計算するのでクライアントからは送らない
      const { error: callErr } = await (supabase.from('calls') as any)
        .update({
          status:   'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', target.id)
        .in('status', ['ringing', 'ongoing']); // 楽観制御：既に ended 等なら更新されない

      if (callErr) {
        console.error('[CallContext] endCall calls update failed:', callErr);
      }

      // ---- 3. messages に call_ended システムメッセージを投稿 ----
      if (!callErr) {
        const { data: updatedCall } = await (supabase.from('calls') as any)
          .select('status, conversation_id')
          .eq('id', target.id)
          .maybeSingle();

        if (updatedCall?.status === 'ended') {
          const { error: msgErr } = await (supabase.from('messages') as any).insert({
            conversation_id: updatedCall.conversation_id,
            user_id: user.id,
            message_type: 'call_ended',
            call_id: target.id,
          });
          if (msgErr) {
            console.warn('[CallContext] call_ended message insert failed:', msgErr);
          }
        }
      }
    } finally {
      // ---- 4. state cleanup（DB 失敗時も必ず実行） ----
      setCurrentCall(null);
      setCallClient(null);
      setIsMuted(false);
      setIsCameraOff(false);
      selfInitiatedCallIdsRef.current.delete(target.id);
      setIsEndingCall(false);
    }
  }, [currentCall, callClient, user?.id]);

  // =====================================================
  // 発信キャンセル（ringing 中の発信者専用）
  // =====================================================
  const cancelOutgoingCall = useCallback(async () => {
    if (!currentCall) return;
    if (!user?.id) throw new Error('Not authenticated');
    if (currentCall.status !== 'ringing') return;
    if (currentCall.initiated_by !== user.id) return;

    setIsCancellingCall(true);

    const target     = currentCall;
    const clientSnap = callClient;

    try {
      // ---- 1. Agora leave ----
      if (clientSnap) {
        await clientSnap.leave().catch((err) => {
          console.error('[CallContext] cancelOutgoingCall leave failed:', err);
        });
      }

      // ---- 2. calls: ended にマーク（ringing のときのみ） ----
      const { error: callErr } = await (supabase.from('calls') as any)
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', target.id)
        .eq('status', 'ringing');

      if (callErr) {
        console.error('[CallContext] cancelOutgoingCall calls update failed:', callErr);
      }

      // ---- 3. 未応答の相手を missed に UPDATE ----
      const { error: invitedErr } = await (supabase.from('call_participants') as any)
        .update({ status: 'missed' })
        .eq('call_id', target.id)
        .eq('status', 'invited');

      if (invitedErr) {
        console.error('[CallContext] cancelOutgoingCall invited update failed:', invitedErr);
      }

      // ---- 4. 自分を left に UPDATE ----
      const { error: selfErr } = await (supabase.from('call_participants') as any)
        .update({ status: 'left', left_at: new Date().toISOString() })
        .eq('call_id', target.id)
        .eq('user_id', user.id);

      if (selfErr) {
        console.error('[CallContext] cancelOutgoingCall self update failed:', selfErr);
      }

      // ---- 5. messages に call_cancelled システムメッセージを投稿 ----
      const { error: msgErr } = await (supabase.from('messages') as any).insert({
        conversation_id: target.conversation_id,
        user_id: user.id,
        message_type: 'call_cancelled',
        call_id: target.id,
      });
      if (msgErr) {
        console.warn('[CallContext] call_cancelled message insert failed:', msgErr);
      }
    } finally {
      setCurrentCall(null);
      setCallClient(null);
      setIsMuted(false);
      setIsCameraOff(false);
      selfInitiatedCallIdsRef.current.delete(target.id);
      setIsCancellingCall(false);
    }
  }, [currentCall, callClient, user?.id]);

  // =====================================================
  // マイクミュートトグル
  // =====================================================
  const toggleMute = useCallback(async () => {
    if (!callClient) return;
    try {
      await callClient.setAudioMuted(!isMuted);
      setIsMuted((prev) => !prev);
    } catch (err) {
      console.error('[CallContext] toggleMute failed:', err);
      throw err;
    }
  }, [callClient, isMuted]);

  // =====================================================
  // ビデオ：ローカルカメラ開始
  // =====================================================
  const startLocalVideo = useCallback(async () => {
    if (!callClient) {
      console.warn('[CallContext] startLocalVideo: no callClient');
      return;
    }
    const container = localVideoContainerRef.current;
    if (!container) {
      console.warn('[CallContext] startLocalVideo: no container');
      return;
    }
    try {
      await callClient.publishVideo(container);
      setIsCameraOff(false);
    } catch (err) {
      console.error('[CallContext] startLocalVideo failed:', err);
      throw err;
    }
  }, [callClient]);

  // =====================================================
  // ビデオ：ローカルカメラ停止
  // =====================================================
  const stopLocalVideo = useCallback(async () => {
    if (!callClient) return;
    try {
      await callClient.unpublishVideo();
    } catch (err) {
      console.error('[CallContext] stopLocalVideo failed:', err);
    }
  }, [callClient]);

  // =====================================================
  // ビデオ：カメラON/OFF切替
  // =====================================================
  const toggleCameraOff = useCallback(async () => {
    if (!callClient) return;
    try {
      const newMuted = !isCameraOff;
      await callClient.setVideoMuted(newMuted);
      setIsCameraOff(newMuted);
    } catch (err) {
      console.error('[CallContext] toggleCameraOff failed:', err);
      throw err;
    }
  }, [callClient, isCameraOff]);

  // =====================================================
  // 着信ダイアログを閉じる（DB を触らずUIだけ閉じる。タイムアウト等で使う）
  // =====================================================
  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  // =====================================================
  // クリーンアップ：ログアウト時に通話を終了
  // =====================================================
  useEffect(() => {
    if (!user) {
      // ログアウトされたので進行中の通話を切る
      if (callClient) {
        callClient.leave().catch((err) => {
          console.error('[CallContext] leave on logout failed:', err);
        });
        setCallClient(null);
      }
      setCurrentCall(null);
      setIncomingCall(null);
      setIsCameraOff(false);
      selfInitiatedCallIdsRef.current.clear();
    }
  }, [user, callClient]);

  return (
    <CallContext.Provider
      value={{
        currentCall,
        incomingCall,
        callClient,
        startCall,
        isStartingCall,
        acceptCall,
        isAcceptingCall,
        rejectCall,
        isRejectingCall,
        endCall,
        isEndingCall,
        cancelOutgoingCall,
        isCancellingCall,
        isMuted,
        toggleMute,
        isCameraOff,
        toggleCameraOff,
        localVideoContainerRef,
        remoteVideoContainerRef,
        startLocalVideo,
        stopLocalVideo,
        dismissIncomingCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

// =====================================================
// useCall フック
// =====================================================

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error('useCall must be used within CallProvider');
  }
  return ctx;
};

