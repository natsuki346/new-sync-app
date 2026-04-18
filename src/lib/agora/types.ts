/**
 * Agora通話クライアントの抽象インターフェース
 *
 * Web (agora-rtc-sdk-ng) / React Native (react-native-agora) の両方が
 * この契約を実装する。SDK固有の型（IAgoraRTCClient等）はこの層より外に漏らさない。
 *
 * これにより、UI層は `CallClient` 型のみを扱えばよく、
 * プラットフォーム間でロジックを共有できる。
 */

// =====================================================
// 接続状態
// =====================================================

export type CallConnectionState =
  | 'DISCONNECTED' // 未接続
  | 'CONNECTING' // 接続中
  | 'CONNECTED' // 接続完了（チャンネル参加済み）
  | 'RECONNECTING' // 再接続中
  | 'DISCONNECTING'; // 切断中

// =====================================================
// リモートユーザー情報
// =====================================================

/**
 * 同じチャンネルにいる他のユーザー情報
 * UI層はこれを使って「誰がミュートしているか」「誰がビデオONか」を把握する
 */
export interface RemoteUser {
  /** AgoraのUID（数値） */
  uid: number;
  /** 音声トラックを公開しているか */
  hasAudio: boolean;
  /** 映像トラックを公開しているか */
  hasVideo: boolean;
}

// =====================================================
// イベント定義
// =====================================================

/**
 * CallClientが発火するイベントの一覧
 * UI層は on() でリスナーを登録し、状態を同期する
 */
export interface CallEventMap {
  /** 他のユーザーがチャンネルに参加した */
  'user-joined': (user: RemoteUser) => void;
  /** 他のユーザーがチャンネルから退出した */
  'user-left': (uid: number) => void;
  /**
   * リモートユーザーがトラックを公開した
   * mediaType: 'audio' = マイクON, 'video' = カメラON
   */
  'user-published': (uid: number, mediaType: 'audio' | 'video') => void;
  /**
   * リモートユーザーがトラックを非公開にした
   * mediaType: 'audio' = マイクOFF, 'video' = カメラOFF
   */
  'user-unpublished': (uid: number, mediaType: 'audio' | 'video') => void;
  /** 接続状態が変化した */
  'connection-state-changed': (state: CallConnectionState) => void;
  /** エラー発生 */
  error: (error: CallError) => void;
}

export type CallEventName = keyof CallEventMap;

// =====================================================
// エラー
// =====================================================

export type CallErrorCode =
  | 'TOKEN_EXPIRED' // トークン期限切れ
  | 'INVALID_TOKEN' // トークン不正
  | 'NETWORK_ERROR' // ネットワーク不良
  | 'PERMISSION_DENIED' // マイク/カメラ権限なし
  | 'DEVICE_NOT_FOUND' // デバイス未検出
  | 'UNKNOWN'; // その他

export interface CallError {
  code: CallErrorCode;
  message: string;
  /** プラットフォーム固有の元エラー（デバッグ用） */
  cause?: unknown;
}

// =====================================================
// ビデオレンダリング
// =====================================================

/**
 * ローカル/リモートビデオを描画する対象要素
 * Web: HTMLElement、RN: コンポーネントRef
 * 現時点ではWebのみ想定のためHTMLElementで定義
 */
export type VideoContainer = HTMLElement;

// =====================================================
// CallClient: 通話クライアントの抽象インターフェース
// =====================================================

export interface CallClient {
  // ===== チャンネル接続 =====

  /**
   * チャンネルに参加する
   * @param params.channelName - Agoraチャンネル名（= calls.channel_name）
   * @param params.token - Edge Functionで発行されたRTCトークン
   * @param params.uid - このユーザーのAgora UID
   * @param params.appId - Agora App ID
   */
  join(params: {
    channelName: string;
    token: string;
    uid: number;
    appId: string;
  }): Promise<void>;

  /** チャンネルから退出する。すべてのトラックも自動で解放される */
  leave(): Promise<void>;

  // ===== 音声 =====

  /** マイクを有効化してトラックを公開する */
  publishAudio(): Promise<void>;
  /** マイクトラックを停止して公開を停止する */
  unpublishAudio(): Promise<void>;
  /**
   * マイクのミュート切り替え（トラックは維持したまま送信だけ止める）
   * unpublishAudioと違い、再開が高速
   */
  setAudioMuted(muted: boolean): Promise<void>;

  // ===== 映像 =====

  /**
   * カメラを有効化してトラックを公開する
   * @param container - ローカルプレビューを描画する要素
   */
  publishVideo(container: VideoContainer): Promise<void>;
  /** カメラトラックを停止して公開を停止する */
  unpublishVideo(): Promise<void>;
  /** カメラのミュート切り替え */
  setVideoMuted(muted: boolean): Promise<void>;

  /**
   * リモートユーザーの映像を指定要素にレンダリングする
   * user-published イベント受信後に呼ぶ
   */
  renderRemoteVideo(uid: number, container: VideoContainer): Promise<void>;

  // ===== イベント =====

  on<E extends CallEventName>(event: E, handler: CallEventMap[E]): void;
  off<E extends CallEventName>(event: E, handler: CallEventMap[E]): void;

  // ===== 状態取得 =====

  getConnectionState(): CallConnectionState;
  getRemoteUsers(): RemoteUser[];
}
