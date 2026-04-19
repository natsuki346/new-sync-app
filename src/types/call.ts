/**
 * SYNC. 通話機能のドメイン型定義
 *
 * DB側の calls / call_participants / messages テーブルは status 等を string 型で保持しているため、
 * アプリ側では Union 型で制約を付けて型安全性を担保する。
 *
 * DB型(Row/Insert/Update) は database.types.ts から参照すること。
 * このファイルは「アプリが扱う通話ドメインの意味論」を定義する。
 */

import type { Database } from '@/lib/database.types';

// =====================================================
// 基本Union型
// =====================================================

/** 通話の種類 */
export type CallType = 'voice' | 'video';

/**
 * 通話全体のステータス（calls.status）
 * - ringing:  発信直後〜最初の誰かが応答するまで
 * - ongoing:  通話中（最低1人が応答済み）
 * - ended:    正常終了
 * - missed:   誰も応答せずタイムアウト（不在着信）
 * - declined: 全員が拒否
 * - failed:   接続失敗などの異常終了
 */
export type CallStatus = 'ringing' | 'ongoing' | 'ended' | 'missed' | 'declined' | 'failed';

/**
 * 参加者個別のステータス（call_participants.status）
 * - invited:  呼び出し中（未応答）
 * - joined:   参加中
 * - declined: 拒否した
 * - missed:   タイムアウトで応答なし
 * - left:     退出済み
 */
export type ParticipantStatus = 'invited' | 'joined' | 'declined' | 'missed' | 'left';

/**
 * メッセージの種類（messages.message_type）
 * 既存: text, image, audio
 * 追加: call_ended, call_missed, call_cancelled
 */
export type MessageType = 'text' | 'image' | 'audio' | 'call_ended' | 'call_missed' | 'call_cancelled';

// =====================================================
// DB Row 型の再エクスポート + Union型による厳密化
// =====================================================

type RawCallRow = Database['public']['Tables']['calls']['Row'];
type RawCallParticipantRow = Database['public']['Tables']['call_participants']['Row'];

/** calls テーブルの Row を Union 型で厳密化したもの */
export type Call = Omit<RawCallRow, 'call_type' | 'status'> & {
  call_type: CallType;
  status: CallStatus;
};

/** call_participants テーブルの Row を Union 型で厳密化したもの */
export type CallParticipant = Omit<RawCallParticipantRow, 'status'> & {
  status: ParticipantStatus;
};

// =====================================================
// Agora 関連の型
// =====================================================

/**
 * Agora参加に必要な情報
 * Edge Function (generate-agora-token) のレスポンスと一致する
 */
export interface AgoraJoinCredentials {
  /** Agora App ID（クライアント側でも使う公開値） */
  appId: string;
  /** 参加対象のチャンネル名（= calls.channel_name） */
  channelName: string;
  /** このユーザー用の Agora RTC トークン */
  token: string;
  /** このユーザー用の Agora UID（32bit unsigned int） */
  uid: number;
  /** トークンの有効期限（UNIXタイムスタンプ、秒） */
  expiresAt: number;
}

// =====================================================
// ユーティリティ：型ガード
// =====================================================

export function isCallType(value: string): value is CallType {
  return value === 'voice' || value === 'video';
}

export function isCallStatus(value: string): value is CallStatus {
  return ['ringing', 'ongoing', 'ended', 'missed', 'declined', 'failed'].includes(value);
}

export function isParticipantStatus(value: string): value is ParticipantStatus {
  return ['invited', 'joined', 'declined', 'missed', 'left'].includes(value);
}

export function isCallMessageType(
  value: string
): value is 'call_ended' | 'call_missed' | 'call_cancelled' {
  return value === 'call_ended' || value === 'call_missed' || value === 'call_cancelled';
}
