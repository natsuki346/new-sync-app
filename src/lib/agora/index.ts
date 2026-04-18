/**
 * Agora通話レイヤーのエントリポイント
 *
 * UI層からはこのファイル経由で CallClient を取得する。
 * プラットフォーム（Web / React Native）の分岐はここで吸収する。
 *
 * 使用例:
 * ```ts
 * 'use client';
 * import { createCallClient } from '@/lib/agora';
 *
 * const client = createCallClient();
 * await client.join({ appId, channelName, token, uid });
 * ```
 */

import type { CallClient } from './types';
import { WebCallClient } from './web';

// 公開する型を re-export（UI層が types.ts を直接触る必要をなくす）
export type {
  CallClient,
  CallConnectionState,
  CallError,
  CallErrorCode,
  CallEventMap,
  CallEventName,
  RemoteUser,
  VideoContainer,
} from './types';

/**
 * プラットフォームに応じた CallClient インスタンスを生成する
 *
 * 現状は Web のみ対応。将来 React Native 対応時は以下のように分岐:
 * ```ts
 * if (Platform.OS === 'ios' || Platform.OS === 'android') {
 *   return new NativeCallClient();
 * }
 * return new WebCallClient();
 * ```
 */
export function createCallClient(): CallClient {
  if (typeof window === 'undefined') {
    throw new Error(
      '[agora] createCallClient() must be called on the client side. ' +
        "Ensure the calling component has 'use client' directive."
    );
  }
  return new WebCallClient();
}
