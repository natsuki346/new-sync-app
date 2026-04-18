/**
 * Web版 Agora実装
 *
 * agora-rtc-sdk-ng をラップし、CallClientインターフェースを実装する。
 * SDK固有の型（IAgoraRTCClient等）はこのファイル内に閉じ込める。
 *
 * ⚠️ このファイルは必ずクライアントコンポーネントからのみ import すること。
 *    'use client' 宣言のない Server Component から import すると SSR でエラーになる。
 */

import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type ILocalAudioTrack,
  type ILocalVideoTrack,
  type IMicrophoneAudioTrack,
  type ICameraVideoTrack,
  type ConnectionState,
} from 'agora-rtc-sdk-ng';

import type {
  CallClient,
  CallConnectionState,
  CallError,
  CallErrorCode,
  CallEventMap,
  CallEventName,
  RemoteUser,
  VideoContainer,
} from './types';

// =====================================================
// ヘルパー：エラー変換
// =====================================================

function toCallError(err: unknown): CallError {
  if (!(err instanceof Error)) {
    return { code: 'UNKNOWN', message: String(err), cause: err };
  }

  const message = err.message;
  let code: CallErrorCode = 'UNKNOWN';

  // Agora SDKの代表的なエラーコードをマッピング
  if (/token.*expired/i.test(message)) code = 'TOKEN_EXPIRED';
  else if (/invalid.*token/i.test(message)) code = 'INVALID_TOKEN';
  else if (/permission.*denied|NotAllowedError/i.test(message))
    code = 'PERMISSION_DENIED';
  else if (/device.*not.*found|NotFoundError/i.test(message))
    code = 'DEVICE_NOT_FOUND';
  else if (/network/i.test(message)) code = 'NETWORK_ERROR';

  return { code, message, cause: err };
}

// =====================================================
// ヘルパー：接続状態変換
// =====================================================

function toConnectionState(state: ConnectionState): CallConnectionState {
  switch (state) {
    case 'CONNECTED':
      return 'CONNECTED';
    case 'CONNECTING':
      return 'CONNECTING';
    case 'RECONNECTING':
      return 'RECONNECTING';
    case 'DISCONNECTING':
      return 'DISCONNECTING';
    case 'DISCONNECTED':
    default:
      return 'DISCONNECTED';
  }
}

// =====================================================
// WebCallClient 実装
// =====================================================

export class WebCallClient implements CallClient {
  private client: IAgoraRTCClient;
  private audioTrack: IMicrophoneAudioTrack | null = null;
  private videoTrack: ICameraVideoTrack | null = null;
  private listeners = new Map<CallEventName, Set<Function>>();

  constructor() {
    // 'rtc' モード + 'vp8' コーデックが最も広くサポートされる
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    this.bindSdkEvents();
  }

  // ===== SDKイベント → 抽象イベントへの橋渡し =====

  private bindSdkEvents(): void {
    this.client.on('user-joined', (user: IAgoraRTCRemoteUser) => {
      this.emit('user-joined', this.toRemoteUser(user));
    });

    this.client.on('user-left', (user: IAgoraRTCRemoteUser) => {
      this.emit('user-left', Number(user.uid));
    });

    this.client.on(
      'user-published',
      async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        try {
          // 購読しないとリモートのメディアを受信できない
          await this.client.subscribe(user, mediaType);

          // 音声は即時再生開始（映像は UI が renderRemoteVideo() を呼ぶまで保留）
          if (mediaType === 'audio' && user.audioTrack) {
            user.audioTrack.play();
          }

          this.emit('user-published', Number(user.uid), mediaType);
        } catch (err) {
          this.emit('error', toCallError(err));
        }
      }
    );

    this.client.on(
      'user-unpublished',
      (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        this.emit('user-unpublished', Number(user.uid), mediaType);
      }
    );

    this.client.on('connection-state-change', (curState: ConnectionState) => {
      this.emit('connection-state-changed', toConnectionState(curState));
    });

    this.client.on('token-privilege-will-expire', () => {
      // トークンが30秒以内に切れる予告。UI層でリフレッシュ処理をフック可能。
      this.emit('error', {
        code: 'TOKEN_EXPIRED',
        message: 'Token will expire soon',
      });
    });
  }

  private toRemoteUser(user: IAgoraRTCRemoteUser): RemoteUser {
    return {
      uid: Number(user.uid),
      hasAudio: Boolean(user.audioTrack),
      hasVideo: Boolean(user.videoTrack),
    };
  }

  // ===== チャンネル接続 =====

  async join(params: {
    channelName: string;
    token: string;
    uid: number;
    appId: string;
  }): Promise<void> {
    try {
      await this.client.join(
        params.appId,
        params.channelName,
        params.token,
        params.uid
      );
    } catch (err) {
      throw toCallError(err);
    }
  }

  async leave(): Promise<void> {
    try {
      // トラックを確実に解放してからleave
      await this.unpublishAudio();
      await this.unpublishVideo();
      await this.client.leave();
    } catch (err) {
      throw toCallError(err);
    }
  }

  // ===== 音声 =====

  async publishAudio(): Promise<void> {
    try {
      if (this.audioTrack) return; // 既に公開中
      this.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await this.client.publish(this.audioTrack);
    } catch (err) {
      throw toCallError(err);
    }
  }

  async unpublishAudio(): Promise<void> {
    if (!this.audioTrack) return;
    try {
      await this.client.unpublish(this.audioTrack);
      this.audioTrack.stop();
      this.audioTrack.close();
      this.audioTrack = null;
    } catch (err) {
      throw toCallError(err);
    }
  }

  async setAudioMuted(muted: boolean): Promise<void> {
    if (!this.audioTrack) return;
    try {
      await this.audioTrack.setMuted(muted);
    } catch (err) {
      throw toCallError(err);
    }
  }

  // ===== 映像 =====

  async publishVideo(container: VideoContainer): Promise<void> {
    try {
      if (this.videoTrack) return;
      this.videoTrack = await AgoraRTC.createCameraVideoTrack();
      this.videoTrack.play(container);
      await this.client.publish(this.videoTrack);
    } catch (err) {
      throw toCallError(err);
    }
  }

  async unpublishVideo(): Promise<void> {
    if (!this.videoTrack) return;
    try {
      await this.client.unpublish(this.videoTrack);
      this.videoTrack.stop();
      this.videoTrack.close();
      this.videoTrack = null;
    } catch (err) {
      throw toCallError(err);
    }
  }

  async setVideoMuted(muted: boolean): Promise<void> {
    if (!this.videoTrack) return;
    try {
      await this.videoTrack.setMuted(muted);
    } catch (err) {
      throw toCallError(err);
    }
  }

  async renderRemoteVideo(
    uid: number,
    container: VideoContainer
  ): Promise<void> {
    const user = this.client.remoteUsers.find(
      (u) => Number(u.uid) === uid
    );
    if (!user || !user.videoTrack) {
      throw {
        code: 'UNKNOWN',
        message: `Remote user ${uid} has no video track`,
      } satisfies CallError;
    }
    user.videoTrack.play(container);
  }

  // ===== イベント =====

  on<E extends CallEventName>(event: E, handler: CallEventMap[E]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off<E extends CallEventName>(event: E, handler: CallEventMap[E]): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit<E extends CallEventName>(
    event: E,
    ...args: Parameters<CallEventMap[E]>
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        (handler as (...a: unknown[]) => void)(...args);
      } catch (err) {
        console.error(`[WebCallClient] Handler error on ${event}:`, err);
      }
    }
  }

  // ===== 状態取得 =====

  getConnectionState(): CallConnectionState {
    return toConnectionState(this.client.connectionState);
  }

  getRemoteUsers(): RemoteUser[] {
    return this.client.remoteUsers.map((u) => this.toRemoteUser(u));
  }
}
