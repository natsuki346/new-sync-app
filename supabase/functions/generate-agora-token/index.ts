/**
 * generate-agora-token
 *
 * Agora RTC Token を生成するEdge Function。
 *
 * フロー:
 *   1. Supabase JWT検証 → user_id取得
 *   2. calls テーブルから callId の行を取得（存在・状態チェック）
 *   3. call_participants で参加資格をチェック
 *   4. agora_uid 未設定なら採番してUPDATE
 *   5. Agora RTC Token を生成（有効期限1時間）
 *   6. レスポンスを返す
 *
 * リクエスト:
 *   POST /functions/v1/generate-agora-token
 *   Authorization: Bearer <supabase_jwt>
 *   Body: { callId: string }
 *
 * レスポンス（成功）:
 *   200 { appId, channelName, token, uid, expiresAt }
 *
 * レスポンス（失敗）:
 *   401 { error: "Unauthorized" }             ← JWTなし or 無効
 *   400 { error: "Invalid request" }          ← Bodyが不正
 *   403 { error: "Not a participant" }        ← callに参加権限なし
 *   404 { error: "Call not found" }           ← call_idが存在しない
 *   410 { error: "Call has ended" }           ← 既に終了した通話
 *   500 { error: "Internal server error" }    ← 予期せぬエラー
 */

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  RtcTokenBuilder,
  RtcRole,
} from "npm:agora-access-token@2.0.4";

// =====================================================
// CORS ヘッダー
// =====================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =====================================================
// 環境変数
// =====================================================

const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID");
const AGORA_APP_CERTIFICATE = Deno.env.get("AGORA_APP_CERTIFICATE");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// =====================================================
// ヘルパー
// =====================================================

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Agora UID を採番する（1〜2^31-1 の範囲のランダム値）
 * 0 は Agora で予約されているので避ける
 * call_participants.agora_uid は INT4（signed 32bit）だが、負数は使わない
 */
function generateAgoraUid(): number {
  return Math.floor(Math.random() * (2147483647 - 1)) + 1;
}

// =====================================================
// メインハンドラ
// =====================================================

Deno.serve(async (req: Request) => {
  // ---- CORS preflight ----
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ---- Method check ----
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ---- 環境変数チェック ----
  if (
    !AGORA_APP_ID ||
    !AGORA_APP_CERTIFICATE ||
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error("[generate-agora-token] Missing environment variables");
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  try {
    // ---- 1. JWT検証 → user_id取得 ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Service Role Key で admin client を作成（RLSバイパス用）
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // JWTからユーザー情報を取得
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;

    // ---- 2. リクエストボディ検証 ----
    let body: { callId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const callId = body.callId;
    if (!callId || typeof callId !== "string") {
      return jsonResponse({ error: "Invalid request: callId required" }, 400);
    }

    // ---- 3. calls テーブルから通話情報を取得 ----
    const { data: call, error: callError } = await supabaseAdmin
      .from("calls")
      .select("id, channel_name, status")
      .eq("id", callId)
      .maybeSingle();

    if (callError) {
      console.error("[generate-agora-token] calls fetch error:", callError);
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    if (!call) {
      return jsonResponse({ error: "Call not found" }, 404);
    }

    if (
      call.status === "ended" ||
      call.status === "missed" ||
      call.status === "declined" ||
      call.status === "failed"
    ) {
      return jsonResponse({ error: "Call has ended" }, 410);
    }

    // ---- 4. 参加資格チェック ----
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("call_participants")
      .select("id, agora_uid")
      .eq("call_id", callId)
      .eq("user_id", userId)
      .maybeSingle();

    if (participantError) {
      console.error(
        "[generate-agora-token] participant fetch error:",
        participantError
      );
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    if (!participant) {
      return jsonResponse({ error: "Not a participant" }, 403);
    }

    // ---- 5. agora_uid 採番（未設定なら） ----
    let agoraUid = participant.agora_uid;
    if (agoraUid === null || agoraUid === undefined) {
      agoraUid = generateAgoraUid();
      const { error: updateError } = await supabaseAdmin
        .from("call_participants")
        .update({ agora_uid: agoraUid })
        .eq("id", participant.id);

      if (updateError) {
        console.error(
          "[generate-agora-token] agora_uid update error:",
          updateError
        );
        return jsonResponse({ error: "Internal server error" }, 500);
      }
    }

    // ---- 6. Agora RTC Token 生成 ----
    const expirationInSeconds = 60 * 60; // 1時間
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationInSeconds;

    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      call.channel_name,
      agoraUid,
      RtcRole.PUBLISHER, // 音声・映像の送受信を許可
      privilegeExpiredTs
    );

    // ---- 7. レスポンス ----
    return jsonResponse({
      appId: AGORA_APP_ID,
      channelName: call.channel_name,
      token: rtcToken,
      uid: agoraUid,
      expiresAt: privilegeExpiredTs,
    });
  } catch (err) {
    console.error("[generate-agora-token] Unexpected error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
