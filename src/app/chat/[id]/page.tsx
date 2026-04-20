'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type Conversation } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/contexts/CallContext';

// ── 開発用自動返信フラグ ──────────────────────────────────────────
const DEV_AUTO_REPLY = false;

// ── 型 ────────────────────────────────────────────────────────────

type ChatMsg = {
  id: number;
  from: 'me' | 'them';
  text?: string;
  image?: string;
  audioUrl?: string;
  audioDuration?: number;
  messageType?: string;
  callInfo?: {
    durationSeconds: number | null;
    status: string;
    callType: 'voice' | 'video';
  };
  time: string;
  isRead: boolean;
  dateLabel: string;
};

type DateSep = { type: 'date'; label: string; key: string };

// ── ヘルパー ──────────────────────────────────────────────────────

function nowTime() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCallDuration(seconds: number | null): string {
  if (seconds == null || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtMsgTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDateLabel(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === now.toDateString())       return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const AUTO_REPLIES = [
  '...', '😊', 'Nice!', 'That sounds fun!', 'For sure!',
  '🔥', 'lol', 'Yeah!', '👍', 'Really?', 'Agreed~',
  "Let's do it!", '😂', 'Same here', "Can't wait!",
];

// ── メインコンポーネント ──────────────────────────────────────────

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { startCall, isStartingCall } = useCall();

  // params.id が conversation_id か user_id かを解決した実際の conversation_id
  const [convId,    setConvId]    = useState<string | null>(null);

  const [convInfo, setConvInfo] = useState<Conversation>({
    id:      params.id,
    avatar:  '👤',
    name:    '…',
    preview: '',
    time:    'Now',
    unread:  false,
    isGroup: false,
  });

  const [input,        setInput]        = useState('');
  const [messages,     setMessages]     = useState<ChatMsg[]>([]);
  const [msgsLoading,  setMsgsLoading]  = useState(true);
  const [settingsOpen,     setSettingsOpen]     = useState(false);
  const [myBubbleColor,    setMyBubbleColor]    = useState('');
  const [theirBubbleColor, setTheirBubbleColor] = useState('');
  const [otherUserId,      setOtherUserId]      = useState<string | null>(null);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── ボイスメッセージ用 state / ref ───────────────────────────────
  const [isRecording,      setIsRecording]      = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob,        setAudioBlob]        = useState<Blob | null>(null);
  const [audioPreviewUrl,  setAudioPreviewUrl]  = useState<string | null>(null);
  const mediaRecorderRef     = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // duration を送信時まで確実に保持するための ref
  const recordedDurationRef  = useRef<number>(0);

  // チャット吹き出し色・文字色を localStorage から読み込む
  const [myMsgColor,    setMyMsgColor]    = useState('');
  const [theirMsgColor, setTheirMsgColor] = useState('');

  useEffect(() => {
    const my    = localStorage.getItem('sync_my_bubble_color');
    const their = localStorage.getItem('sync_their_bubble_color');
    if (my    !== null) setMyBubbleColor(my);
    if (their !== null) setTheirBubbleColor(their);
    setMyMsgColor(localStorage.getItem('sync_my_msg_color') || '');
    setTheirMsgColor(localStorage.getItem('sync_their_msg_color') || '');
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── params.id を conversation_id に解決 ──────────────────────
  // プロフィール画面など user_id を渡してきた場合、DM を検索または作成する
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      // まず conversation_id として検索
      const { data: convCheck } = await (supabase as any)
        .from('conversations')
        .select('id')
        .eq('id', params.id)
        .maybeSingle();

      if (cancelled) return;

      if (convCheck) {
        // 有効な conversation_id だったのでそのまま使用
        setConvId(params.id);
        return;
      }

      // conversation_id として見つからなかった → user_id として扱い DM を検索 / 作成
      const targetUserId = params.id;
      if (!cancelled) setOtherUserId(targetUserId);

      const { data: myConvIds } = await (supabase as any)
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      const myIds: string[] = (myConvIds ?? []).map((r: any) => r.conversation_id);

      if (myIds.length > 0) {
        const { data: shared } = await (supabase as any)
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', myIds);

        const sharedIds: string[] = (shared ?? []).map((r: any) => r.conversation_id);

        if (sharedIds.length > 0) {
          const { data: existing } = await (supabase as any)
            .from('conversations')
            .select('id')
            .eq('type', 'dm')
            .in('id', sharedIds)
            .maybeSingle();

          if (!cancelled && existing) {
            setConvId(existing.id);
            return;
          }
        }
      }

      if (cancelled) return;

      // 新規 DM 作成
      const { data: newConv, error } = await (supabase as any)
        .from('conversations')
        .insert({ type: 'dm', created_by: user.id })
        .select('id')
        .single();

      if (cancelled || error || !newConv) return;

      await (supabase as any)
        .from('conversation_members')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: targetUserId },
        ]);

      if (!cancelled) setConvId(newConv.id);
    })();

    return () => { cancelled = true; };
  }, [params.id, user?.id]);

  // ── 会話情報取得 ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !convId) return;
    let cancelled = false;

    (async () => {
      // ① 会話の基本情報（type, name）を取得
      const { data: conv, error: convErr } = await (supabase as any)
        .from('conversations')
        .select('id, type, name')
        .eq('id', convId)
        .single();

      if (cancelled || convErr || !conv) return;

      // ② conversation_members + profiles を独立クエリで取得（ネストジョイン非依存）
      const { data: membersRaw } = await (supabase as any)
        .from('conversation_members')
        .select(`
          user_id,
          profiles (id, username, display_name, avatar_url)
        `)
        .eq('conversation_id', convId);

      if (cancelled) return;

      const members: any[] = membersRaw ?? [];

      // profiles が配列で返る場合も正規化
      const normalize = (raw: any) =>
        Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);

      let info: Conversation;

      if (conv.type === 'dm') {
        const otherMember = members.find((m: any) => m.user_id !== user.id);
        const uid         = otherMember?.user_id ?? null;
        let   prof: any   = normalize(otherMember?.profiles);

        // NOTE: profilesテーブルのRLSに以下のpolicyが必要：
        // CREATE POLICY "profiles are viewable by authenticated users"
        // ON profiles FOR SELECT
        // TO authenticated
        // USING (true);
        //
        // JOINが失敗した場合（RLS未設定・FK未定義など）、直接profilesテーブルから取得
        if (!prof && uid) {
          const { data: fallbackProfile } = await (supabase as any)
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', uid)
            .maybeSingle();
          prof = normalize(fallbackProfile);
        }

        if (!cancelled && uid) setOtherUserId(uid);

        info = {
          id:      conv.id,
          avatar:  prof?.avatar_url   ?? '👤',
          name:    prof?.display_name ?? prof?.username ?? 'Unknown',
          handle:  prof?.username ? `@${prof.username}` : undefined,
          preview: '',
          time:    'Now',
          unread:  false,
          isGroup: false,
        };
      } else {
        const memberAvatars = members.map((m: any) =>
          normalize(m.profiles)?.avatar_url ?? '👤'
        );
        info = {
          id:           conv.id,
          avatar:       memberAvatars[0] ?? '👥',
          name:         conv.name ?? 'Group',
          preview:      '',
          time:         'Now',
          unread:       false,
          isGroup:      true,
          memberAvatars,
        };
      }

      if (!cancelled) setConvInfo(info);
    })();

    return () => { cancelled = true; };
  }, [convId, user?.id]);

  // ── メッセージ初期取得 ────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !convId) return;
    let cancelled = false;
    setMsgsLoading(true);

    (async () => {
      const { data, error } = await (supabase as any)
        .from('messages')
        .select(`
          id, content, message_type, image_url, audio_url, audio_duration_seconds,
          created_at, user_id, call_id,
          call:calls(duration_seconds, status, call_type)
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (cancelled) return;
      if (error) { setMsgsLoading(false); return; }

      const msgs: ChatMsg[] = (data ?? []).map((row: any, i: number) => ({
        id:            i,
        from:          row.user_id === user.id ? 'me' as const : 'them' as const,
        text:          row.message_type === 'text'  ? (row.content   ?? undefined) : undefined,
        image:         row.message_type === 'image' ? (row.image_url ?? undefined) : undefined,
        audioUrl:      row.message_type === 'audio' ? (row.audio_url ?? undefined) : undefined,
        audioDuration: row.audio_duration_seconds ?? undefined,
        messageType:   row.message_type ?? undefined,
        callInfo: (row.message_type === 'call_ended' || row.message_type === 'call_missed' || row.message_type === 'call_cancelled')
          ? {
              durationSeconds: row.call?.duration_seconds ?? null,
              status:   row.call?.status   ?? '',
              callType: row.call?.call_type ?? 'voice',
            }
          : undefined,
        time:          fmtMsgTime(row.created_at),
        isRead:        true,
        dateLabel:     fmtDateLabel(row.created_at),
      }));

      if (!cancelled) {
        setMessages(msgs);
        setMsgsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [convId, user?.id]);

  // ── Realtime メッセージ受信 ───────────────────────────────────
  useEffect(() => {
    if (!user?.id || !convId) return;

    const channel = (supabase as any)
      .channel(`chat-${convId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (row.user_id === user.id) return; // 自分の送信はスキップ

          const newMsg: ChatMsg = {
            id:            Date.now(),
            from:          'them',
            text:          row.message_type === 'text'  ? (row.content   ?? undefined) : undefined,
            image:         row.message_type === 'image' ? (row.image_url ?? undefined) : undefined,
            audioUrl:      row.message_type === 'audio' ? (row.audio_url ?? undefined) : undefined,
            audioDuration: row.audio_duration_seconds ?? undefined,
            messageType:   row.message_type ?? undefined,
            callInfo: (row.message_type === 'call_ended' || row.message_type === 'call_missed' || row.message_type === 'call_cancelled')
              ? {
                  durationSeconds: row.call?.duration_seconds ?? null,
                  status:   row.call?.status   ?? '',
                  callType: row.call?.call_type ?? 'voice',
                }
              : undefined,
            time:          fmtMsgTime(row.created_at),
            isRead:        true,
            dateLabel:     fmtDateLabel(row.created_at),
          };

          setMessages((prev) => [...prev, newMsg]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [convId, user?.id]);

  // ── テキスト送信 ──────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const txt = input.trim();
    if (!txt || !convId) return;
    const t = nowTime();
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, isRead: true })),
      { id: Date.now(), from: 'me' as const, text: txt, time: t, isRead: false, dateLabel: 'Today' },
    ]);
    setInput('');
    if (user) {
      (supabase.from('messages') as any).insert({
        conversation_id: convId,
        user_id:         user.id,
        content:         txt,
        message_type:    'text',
      }).then(({ error }: { error: unknown }) => {
        if (error) console.error('[sendMessage]', error);
      });
    }
    if (DEV_AUTO_REPLY) {
      const delay = 1000 + Math.random() * 1500;
      setTimeout(() => {
        const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
        setMessages((prev) => [
          ...prev.map((m) => (m.from === 'me' ? { ...m, isRead: true } : m)),
          { id: Date.now() + 1, from: 'them' as const, text: reply, time: nowTime(), isRead: true, dateLabel: 'Today' },
        ]);
      }, delay);
    }
  }, [input, convId, user]);

  // ── 画像送信 ──────────────────────────────────────────────────
  const sendImage = useCallback((dataUrl: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: 'me' as const, image: dataUrl, time: nowTime(), isRead: false, dateLabel: 'Today' },
    ]);
  }, []);

  const handleRedial = async (callInfo: ChatMsg['callInfo']) => {
    if (!convId || !otherUserId || !callInfo?.callType) return;
    if (isStartingCall) return;
    try {
      await startCall({
        conversationId: convId,
        calleeUserIds: [otherUserId],
        callType: callInfo.callType,
      });
    } catch (err) {
      console.error('[redial] failed', err);
    }
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    const ext  = file.name.split('.').pop();
    const path = `chat/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error('upload error:', JSON.stringify(uploadError));
      return;
    }

    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // ローカル state に即反映
    sendImage(publicUrl);

    // DB に保存
    const { error: insertError } = await (supabase.from('messages') as any).insert({
      conversation_id: convId,
      user_id:         user.id,
      content:         publicUrl,
      message_type:    'image',
      image_url:       publicUrl,
    });
    if (insertError) console.error('[sendImage]', insertError);
  };

  // ── ボイスメッセージ送受信 ────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordedDurationRef.current = 0;

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          recordedDurationRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('マイクアクセス失敗:', err);
      alert('マイクへのアクセスを許可してください');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
  }

  function cancelRecording() {
    stopRecording();
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecordingSeconds(0);
  }

  async function sendVoiceMessage() {
    if (!audioBlob || !user || !convId) return;
    const duration = recordedDurationRef.current;
    const ext      = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const filepath = `voice/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-audio')
      .upload(filepath, audioBlob, { contentType: audioBlob.type });

    if (uploadError) {
      console.error('Voice upload error:', uploadError);
      alert('送信に失敗しました');
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-audio')
      .getPublicUrl(filepath);

    // ローカルに即反映
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: 'me' as const, audioUrl: publicUrl, audioDuration: duration, time: nowTime(), isRead: false, dateLabel: 'Today' },
    ]);

    const { error: insertError } = await (supabase.from('messages') as any).insert({
      conversation_id:        convId,
      user_id:                user.id,
      message_type:           'audio',
      audio_url:              publicUrl,
      audio_duration_seconds: duration,
      content:                null,
    });
    if (insertError) console.error('[sendVoice]', insertError);

    cancelRecording();
  }

  // 日付区切りを挿入
  const rendered: Array<ChatMsg | DateSep> = messages.reduce<Array<ChatMsg | DateSep>>(
    (acc, msg, i) => {
      const prev = messages[i - 1];
      if (!prev || prev.dateLabel !== msg.dateLabel) {
        acc.push({ type: 'date', label: msg.dateLabel, key: `d-${i}` });
      }
      acc.push(msg);
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── ヘッダー ─────────────────────────────────────────────── */}
      <header
        className="px-4 pt-12 pb-2 flex items-center gap-3 flex-shrink-0"
        style={{
          background: 'var(--background)',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        {/* 戻るボタン */}
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 active:scale-90 transition-transform"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className="w-4 h-4" style={{ color: 'var(--muted)' }}
          >
            <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* アバター */}
        {convInfo.isGroup ? (
          <MiniGroupAvatar avatars={convInfo.memberAvatars ?? []} />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}
          >
            {convInfo.avatar}
          </div>
        )}

        {/* 名前 + ステータス */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>
            {convInfo.name}
          </p>
          <p className="text-[10px] font-medium" style={{ color: 'rgba(136,136,170,0.55)' }}>
            {convInfo.isGroup && convInfo.memberAvatars
              ? `${convInfo.memberAvatars.length} members`
              : 'last seen recently'}
          </p>
        </div>

        {/* 通話・ビデオ・メニューボタン */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* 電話 */}
          <button
  onClick={() => {
    if (!convId || !otherUserId) return;
    startCall({
      conversationId: convId,
      calleeUserIds: [otherUserId],
      callType: 'voice',
    }).catch((err) => {
      console.error('[voice call] failed:', err);
      alert('発信に失敗しました: ' + (err?.message ?? 'unknown'));
    });
  }}
  disabled={isStartingCall || !otherUserId}
  className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
  style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            </svg>
          </button>
          {/* ビデオ */}
<button
  onClick={() => {
    if (!convId || !otherUserId) return;
    startCall({
      conversationId: convId,
      calleeUserIds: [otherUserId],
      callType: 'video',
    }).catch((err) => {
      console.error('[video call] failed:', err);
      alert('発信に失敗しました: ' + (err?.message ?? 'unknown'));
    });
  }}
  disabled={isStartingCall || !otherUserId}
  className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
  style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 9.75v9A2.25 2.25 0 004.5 18.75z"
              />
            </svg>
          </button>
          {/* 3点メニュー */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor"
              className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <circle cx="12" cy="5"  r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── メッセージエリア ──────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5"
        style={{ background: 'var(--background)' }}
      >
        {msgsLoading ? (
          <div className="flex items-center justify-center flex-1 py-20">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
          </div>
        ) : rendered.map((item) => {

          if ('type' in item) {
            return (
              <div key={item.key} className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--surface-2)' }} />
                <span
                  className="text-[10px] font-medium px-3 py-1 rounded-full flex-shrink-0"
                  style={{
                    color: 'var(--muted)',
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-2)',
                  }}
                >
                  {item.label}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--surface-2)' }} />
              </div>
            );
          }

          const msg         = item as ChatMsg;
          const msgIdx      = messages.findIndex((m) => m.id === msg.id);
          const prevMsg     = messages[msgIdx - 1];
          const nextMsg     = messages[msgIdx + 1];
          const isMe        = msg.from === 'me';
          const showAvatar  = !isMe && (!prevMsg || prevMsg.from !== 'them' || prevMsg.dateLabel !== msg.dateLabel);
          const isLastGroup = !nextMsg || nextMsg.from !== msg.from || nextMsg.dateLabel !== msg.dateLabel;

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-1.5 mt-0.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${
                !showAvatar && !isMe ? 'pl-9' : ''
              }`}
            >
              {/* 相手アバター */}
              {!isMe && (
                <div className="w-8 h-8 flex-shrink-0 self-end mb-0.5">
                  {showAvatar ? (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      {convInfo.avatar}
                    </div>
                  ) : null}
                </div>
              )}

              {/* 吹き出し */}
              <div
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                style={{ maxWidth: '72%' }}
              >
                {msg.messageType === 'call_ended' ? (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 inline-flex flex-col items-start gap-1">
                    <span className="text-sm text-gray-300">
                      📞 {msg.callInfo?.callType === 'video' ? 'ビデオ通話' : '音声通話'}
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {formatCallDuration(msg.callInfo?.durationSeconds ?? null)}
                    </span>
                  </div>
                ) : msg.messageType === 'call_missed' ? (
                  <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 inline-flex flex-col items-start gap-2">
                    <span className="text-sm text-red-400 font-medium">📞✕ 不在着信</span>
                    <button
                      className="text-xs text-red-300 hover:text-red-200 underline disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isStartingCall || !otherUserId}
                      onClick={() => handleRedial(msg.callInfo)}
                    >
                      かけ直す
                    </button>
                  </div>
                ) : msg.messageType === 'call_cancelled' ? (
                  <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 inline-flex flex-col items-start gap-2">
                    <span className="text-sm text-red-400 font-medium">📞✕ キャンセル</span>
                    <button
                      className="text-xs text-red-300 hover:text-red-200 underline disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isStartingCall || !otherUserId}
                      onClick={() => handleRedial(msg.callInfo)}
                    >
                      かけ直す
                    </button>
                  </div>
                ) : (
                  <div
                    className={`text-sm leading-relaxed select-none ${
                      (msg.image || msg.audioUrl) ? 'overflow-hidden p-0' : 'px-3.5 py-2'
                    }`}
                    style={
                      isMe
                        ? {
                            background: !myBubbleColor || myBubbleColor === 'rainbow'
                              ? 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)'
                              : myBubbleColor,
                            color: myMsgColor || '#ffffff',
                            borderRadius: '18px 18px 4px 18px',
                            fontWeight: 500,
                            boxShadow: '0 2px 8px rgba(155,89,182,0.3)',
                          }
                        : {
                            background: theirBubbleColor || 'rgba(255,255,255,0.08)',
                            color: theirMsgColor || 'var(--foreground)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '18px 18px 18px 4px',
                            backdropFilter: 'blur(8px)',
                          }
                    }
                  >
                    {msg.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={msg.image}
                        alt="sent image"
                        className="max-w-full max-h-60 object-cover"
                        style={{ borderRadius: 'inherit' }}
                      />
                    ) : msg.audioUrl ? (
                      <VoiceMessagePlayer
                        url={msg.audioUrl}
                        duration={msg.audioDuration ?? 0}
                        isMyMessage={isMe}
                        bubbleColor={
                          isMe
                            ? (!myBubbleColor || myBubbleColor === 'rainbow'
                                ? 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)'
                                : myBubbleColor)
                            : (theirBubbleColor || 'rgba(255,255,255,0.08)')
                        }
                        textColor={isMe ? (myMsgColor || '#ffffff') : (theirMsgColor || 'var(--foreground)')}
                      />
                    ) : (
                      msg.text
                    )}
                  </div>
                )}
              </div>

              {/* 時刻 + 既読（グループ末尾のみ） */}
              {isLastGroup && (
                <div
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-0.5 flex-shrink-0 self-end mb-0.5`}
                >
                  {isMe && (
                    <span
                      className="text-[9px] font-medium leading-none"
                      style={{ color: msg.isRead ? 'var(--brand)' : 'var(--muted)' }}
                    >
                      {msg.isRead ? 'Read' : 'Sent'}
                    </span>
                  )}
                  <span className="text-[9px] leading-none" style={{ color: 'var(--muted)' }}>
                    {msg.time}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageFile}
      />

      {/* ── 入力エリア ────────────────────────────────────────────── */}
      <div
        className="border-t px-3 pt-2 pb-6 flex-shrink-0"
        style={{ borderColor: 'var(--surface-2)', background: 'var(--background)' }}
      >

        {/* 録音中UI */}
        {isRecording ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,59,48,0.1)', borderRadius: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b30', flexShrink: 0, animation: 'pulse 1s ease-in-out infinite' }} />
            <span style={{ fontSize: 14, color: 'var(--foreground)' }}>録音中 {formatDuration(recordingSeconds)}</span>
            <div style={{ flex: 1 }} />
            <button
              onClick={cancelRecording}
              style={{ padding: '5px 12px', borderRadius: 16, background: 'transparent', border: '1px solid var(--muted)', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}
            >
              キャンセル
            </button>
            <button
              onClick={stopRecording}
              style={{ width: 36, height: 36, borderRadius: '50%', background: '#ff3b30', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
            >
              ⏹
            </button>
          </div>

        ) : audioBlob ? (
          /* 録音後プレビューUI */
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface)', borderRadius: 24 }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={audioPreviewUrl!} style={{ flex: 1, height: 32, minWidth: 0 }} />
            <button
              onClick={cancelRecording}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}
              title="削除"
            >
              🗑
            </button>
            <button
              onClick={sendVoiceMessage}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                background: !myBubbleColor || myBubbleColor === 'rainbow'
                  ? 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)'
                  : myBubbleColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(150,100,255,0.4)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="#0d0d1a" style={{ width: 16, height: 16 }}>
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>

        ) : (
          /* 通常入力UI */
          <div className="flex items-center gap-2">

            {/* カメラボタン（常時表示） */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                />
              </svg>
            </button>

            {/* テキスト入力 */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message…"
              className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)', color: 'var(--foreground)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,26,26,0.4)'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--surface-2)'; }}
            />

            {/* 右側ボタン群: 入力中→送信 / 未入力→マイク・写真 */}
            {input.trim() ? (
              <button
                onClick={sendMessage}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center active:scale-90 transition-all"
                style={{
                  background: !myBubbleColor || myBubbleColor === 'rainbow'
                    ? 'linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)'
                    : myBubbleColor,
                  borderRadius: '50%',
                  boxShadow: '0 2px 12px rgba(150,100,255,0.4)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="#0d0d1a" className="w-4 h-4">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* マイク（録音開始） */}
                <button
                  onClick={startRecording}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                    className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
                {/* 写真 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                    className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </button>
              </div>
            )}

          </div>
        )}

      </div>

      {/* ── チャット設定パネル（右スライドイン） ─────────────────── */}
      {settingsOpen && (
        <div
          className="absolute inset-0 z-50 settings-slide"
          style={{ background: 'var(--background)' }}
        >
          {convInfo.isGroup
            ? <GroupSettings  conv={convInfo} onClose={() => setSettingsOpen(false)} />
            : <DmSettings     conv={convInfo} onClose={() => setSettingsOpen(false)} otherUserId={otherUserId} />
          }
        </div>
      )}

    </div>
  );
}

// ── 音声メッセージプレイヤー ──────────────────────────────────────

function VoiceMessagePlayer({
  url, duration, isMyMessage, bubbleColor, textColor,
}: {
  url: string;
  duration: number;
  isMyMessage: boolean;
  bubbleColor: string;
  textColor: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrent(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrent(0); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const total = duration || audioRef.current?.duration || 0;
  const progress = total > 0 ? Math.min(current / total, 1) : 0;

  const trackAlpha = isMyMessage ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)';
  const fillAlpha  = isMyMessage ? 'rgba(255,255,255,0.85)' : textColor;

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: 210,
        padding: '10px 12px',
        background: bubbleColor,
        borderRadius: isMyMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        boxSizing: 'border-box',
      }}
    >
      {/* 再生/停止ボタン */}
      <button
        onClick={togglePlay}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: isMyMessage ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: textColor,
          fontSize: 13,
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>

      {/* 進捗バー + 時間 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: trackAlpha,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: fillAlpha,
              borderRadius: 2,
              transition: 'width 0.1s linear',
            }}
          />
        </div>
        <span style={{ fontSize: 10, color: textColor, opacity: 0.75, letterSpacing: '0.02em' }}>
          {playing ? fmt(current) : fmt(total)}
        </span>
      </div>
    </div>
  );
}

// ── ヘッダー用グループアバター ────────────────────────────────────

function MiniGroupAvatar({ avatars }: { avatars: string[] }) {
  const shown = avatars.slice(0, 2);
  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      {shown.map((av, i) => (
        <div
          key={i}
          className="absolute w-7 h-7 rounded-full flex items-center justify-center border-2"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--background)',
            top:      i === 0 ? 0 : 6,
            left:     i === 0 ? 0 : 6,
            fontSize: 12,
            zIndex:   i === 0 ? 1 : 2,
          }}
        >
          {av}
        </div>
      ))}
    </div>
  );
}

// ── 設定画面共通ヘッダー ──────────────────────────────────────────

function SettingsHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header
      className="px-4 pt-12 pb-3 flex items-center gap-3 flex-shrink-0"
      style={{
        background: 'var(--background)',
        borderBottom: '1px solid var(--surface-2)',
      }}
    >
      <button
        onClick={onBack}
        className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 active:scale-90 transition-transform"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="w-4 h-4" style={{ color: 'var(--muted)' }}
        >
          <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
        {title}
      </h2>
    </header>
  );
}

// ── メディアプレースホルダーグリッド ─────────────────────────────

function MediaGrid() {
  const t = useTranslations('chat');
  return (
    <div>
      <SectionLabel label={t('mediaSection')} />
      <div className="grid grid-cols-3 gap-1 px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl"
            style={{
              background: `linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)`,
              border: '1px solid var(--surface-2)',
            }}
          />
        ))}
      </div>
      <button
        className="w-full text-center text-xs font-medium py-3 mt-1 active:opacity-60 transition-opacity"
        style={{ color: 'var(--brand)' }}
      >
        {t('seeAll')}
      </button>
    </div>
  );
}

// ── セクションラベル ──────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      className="px-4 pb-2 text-[11px] font-semibold tracking-wide uppercase"
      style={{ color: 'var(--muted)' }}
    >
      {label}
    </p>
  );
}

// ── セクション区切り ──────────────────────────────────────────────

function Divider() {
  return <div className="h-px mx-4 my-4" style={{ background: 'var(--surface-2)' }} />;
}

// ── 設定行コンポーネント ──────────────────────────────────────────

function SettingsRow({
  icon, label, color = 'var(--foreground)', chevron = true, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  chevron?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-4 px-4 py-3.5 active:opacity-60 transition-opacity text-left"
      onClick={onClick}
    >
      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
      >
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium" style={{ color }}>
        {label}
      </span>
      {chevron && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }}
        >
          <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </button>
  );
}

// ── トグル行 ─────────────────────────────────────────────────────

function ToggleRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
      >
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </span>
      {/* トグルスイッチ */}
      <button
        onClick={() => setOn((v) => !v)}
        className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
        style={{ background: on ? 'var(--brand)' : 'var(--surface-2)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
          style={{
            background: on ? '#0d0d1a' : 'var(--muted)',
            left: on ? 'calc(100% - 22px)' : '2px',
          }}
        />
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DM 設定画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DmSettings({ conv, onClose, otherUserId }: { conv: Conversation; onClose: () => void; otherUserId: string | null }) {
  const t = useTranslations('chat');
  const router = useRouter();
  return (
    <div className="flex flex-col h-full">
      <SettingsHeader title={t('talkSettings')} onBack={onClose} />

      <div className="flex-1 overflow-y-auto">

        {/* プロフィールカード */}
        <div className="flex flex-col items-center pt-8 pb-6 px-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-3"
            style={{
              background: 'var(--surface-2)',
              border: '2px solid var(--surface-2)',
              boxShadow: '0 0 0 3px rgba(255,26,26,0.15)',
            }}
          >
            {conv.avatar}
          </div>
          <p className="text-base font-bold mb-0.5" style={{ color: 'var(--foreground)' }}>
            {conv.name}
          </p>
          {conv.handle && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {conv.handle}
            </p>
          )}
          <button
            onClick={() => otherUserId && router.push(`/profile/${otherUserId}`)}
            className="mt-4 px-5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform"
            style={{
              background: 'rgba(255,26,26,0.1)',
              border: '1px solid rgba(255,26,26,0.3)',
              color: 'var(--brand)',
              opacity: otherUserId ? 1 : 0.4,
              cursor: otherUserId ? 'pointer' : 'default',
            }}
          >
            {t('viewProfile')}
          </button>
        </div>

        <Divider />

        {/* メディア */}
        <MediaGrid />

        <Divider />

        {/* 設定 */}
        <SectionLabel label={t('settingsSection')} />
        <ToggleRow icon="🔕" label={t('muteNotifications')} />

        <Divider />

        {/* 危険な操作 */}
        <SectionLabel label={t('otherSection')} />
        <SettingsRow icon="🚫" label={t('block')}  color="#FF453A" />
        <SettingsRow icon="⚠️" label={t('report')} color="#FF453A" />

        <div className="h-8" />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// グループ設定画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GroupSettings({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const t = useTranslations('chat');
  const [groupName, setGroupName] = useState(conv.name);
  const [editing,   setEditing]   = useState(false);
  const members = conv.memberAvatars ?? [];

  return (
    <div className="flex flex-col h-full">
      <SettingsHeader title={t('groupSettings')} onBack={onClose} />

      <div className="flex-1 overflow-y-auto">

        {/* グループアイコン・名前編集 */}
        <div className="flex flex-col items-center pt-8 pb-6 px-4">
          {/* アイコン */}
          <div className="relative mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{
                background: 'var(--surface-2)',
                border: '2px solid var(--surface-2)',
                boxShadow: '0 0 0 3px rgba(255,26,26,0.15)',
              }}
            >
              {conv.avatar}
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--brand)',
                border: '2px solid var(--background)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5}
                className="w-3.5 h-3.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
              </svg>
            </button>
          </div>

          {/* グループ名編集 */}
          {editing ? (
            <div className="flex items-center gap-2 w-full max-w-[240px]">
              <input
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="flex-1 text-center text-base font-bold rounded-xl px-3 py-1.5 outline-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(255,26,26,0.4)',
                  color: 'var(--foreground)',
                }}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
              />
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
              onClick={() => setEditing(true)}
            >
              <span className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                {groupName}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
              </svg>
            </button>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            {members.length} members
          </p>
        </div>

        <Divider />

        {/* イベント情報 */}
        <SectionLabel label={t('eventSection')} />
        <div
          className="mx-4 rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'rgba(255,26,26,0.1)', border: '1px solid rgba(255,26,26,0.2)' }}
          >
            🎸
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              JPRock Live 2024
            </p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              2024.12.15 · Zepp Tokyo
            </p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: 'var(--muted)' }}
          >
            <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>

        <Divider />

        {/* メンバー一覧 */}
        <div className="flex items-center justify-between px-4 mb-2">
          <SectionLabel label={`${t('members')} (${members.length})`} />
          <button
            className="text-xs font-semibold active:opacity-60 transition-opacity"
            style={{ color: 'var(--brand)' }}
          >
            {t('addMember')}
          </button>
        </div>
        <ul>
          {members.map((av, idx) => (
            <li key={idx} className="flex items-center gap-3 px-4 py-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: 'var(--surface-2)' }}
              >
                {av}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  member
                </p>
              </div>
              <button
                className="text-[11px] font-medium px-3 py-1 rounded-full active:opacity-60 transition-opacity"
                style={{
                  background: 'rgba(255,69,58,0.08)',
                  border: '1px solid rgba(255,69,58,0.2)',
                  color: '#FF453A',
                }}
              >
                {t('removeMember')}
              </button>
            </li>
          ))}
        </ul>

        <Divider />

        {/* メディア */}
        <MediaGrid />

        <Divider />

        {/* 設定 */}
        <SectionLabel label={t('settingsSection')} />
        <ToggleRow icon="🔕" label={t('muteNotifications')} />

        <Divider />

        {/* 危険な操作 */}
        <SectionLabel label={t('otherSection')} />
        <SettingsRow icon="🚪" label={t('leaveGroup')} color="#FF453A" />
        <SettingsRow icon="⚠️" label={t('report')}     color="#FF453A" />

        <div className="h-8" />
      </div>
    </div>
  );
}
