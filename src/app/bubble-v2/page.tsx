'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import SyncLogo from '@/components/SyncLogo';
import ReactionFloatingEffect from '@/components/ReactionFloatingEffect';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ── 定数 ────────────────────────────────────────────────────────────────

const MAX_CHARS        = 15;
const ONLINE           = 30;

const BUBBLE_LIFETIME  = 10;    // 自分バブルの寿命（秒）
const DANGER_THRESHOLD = 3;    // 残り3秒で危険演出
// 他人バブルのタイミング
const PERSON_BUBBLE_SHOW_MS  = 10_000;            // 表示時間 10秒
const PERSON_BUBBLE_MIN_MS   = 10_000;            // 送信間隔 最小 10秒
const PERSON_BUBBLE_RANGE_MS = 20_000;            // 送信間隔 幅 20秒（→最大 30秒）

// ── 時間帯背景（bubble/page.tsxから転用） ───────────────────────────────

type ToD = 'morning' | 'day' | 'evening' | 'night';

const TIME_BG: Record<ToD, string> = {
  morning: 'linear-gradient(185deg,#3A8CC0 0%,#70B8DA 16%,#F8CE70 42%,#FFC090 62%,#FFE4CC 82%,#FFF8F0 100%)',
  day:     'linear-gradient(180deg,#0C5A9C 0%,#2880BC 22%,#4CAAD8 48%,#94CDE8 72%,#D4ECFA 90%,#EEF8FF 100%)',
  evening: 'linear-gradient(185deg,#040114 0%,#180448 12%,#560878 28%,#B0165A 50%,#E43018 68%,#F87028 84%,#FFAE40 100%)',
  night:   'linear-gradient(190deg,#010108 0%,#030318 28%,#070540 58%,#040320 80%,#010108 100%)',
};

const getToD = (h: number): ToD =>
  h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night';

const makeId = () => Math.random().toString(36).slice(2, 9);

// 他人バブルのカラフルな枠線色（インデックスで固定割り当て）
const BUBBLE_COLORS = [
  '#D455A8', '#20C8C8', '#48C468', '#7C6FE8',
  '#E8A020', '#2890D8', '#E84040', '#E8C820',
];

function makeFloatData() {
  return {
    floatDuration: 5 + Math.random() * 4,  // 5〜9秒
    floatDelay:    Math.random() * 3,       // 0〜3秒の初期遅延
  };
}

// ── 絵文字プール（住人アイコンに使用） ─────────────────────────────────────

const EMOJI_POOL = [
  '😊','🎵','🌸','🍜','🎲','☕','🍻','🌙','⚡','🦁',
  '🐻','🌊','🎸','🦋','🌻','🍎','🎯','🌈','🚀','💎',
  '🎭','🦊','🐸','🌿','🎪','🏄','🌺','🎨','🦄',
];

// ── モックデータ（フォールバック用・実データ取得成功時は使用しない） ──────────
/*
const PEOPLE: { id: number; emoji: string; messages: [string, string, string] }[] = [
  { id:  1, emoji: '😊', messages: ['今日いい天気！',      '散歩してきた',    'いい朝だ〜'] },
  { id:  2, emoji: '🎵', messages: ['音楽最高♪',          'ライブ行きたい',   '新曲きた！'] },
  { id:  3, emoji: '🌸', messages: ['桜みてきた',          '春だね〜',         '花粉つらい...'] },
  { id:  4, emoji: '🍜', messages: ['ランチ美味しかった',  'ラーメン食べた',   'お腹すいた〜'] },
  { id:  5, emoji: '🎲', messages: ['ボドゲやりたい',      '誰か暇な人！',     '負けた...'] },
  { id:  6, emoji: '☕', messages: ['コーヒー3杯目',       'カフェにいる',     '眠い...'] },
  { id:  7, emoji: '🍻', messages: ['今夜飲もう！',        '乾杯🍻',           '二日酔いつらい'] },
  { id:  8, emoji: '🌙', messages: ['深夜テンション',      'もう寝よ',         '夜型人間'] },
  { id:  9, emoji: '⚡', messages: ['エナドリ飲んだ',      'テスト前死ぬ',     '締め切りやばい'] },
  { id: 10, emoji: '🦁', messages: ['ジム行ってきた',      '筋肉痛...',        '今日も頑張る！'] },
  { id: 11, emoji: '🐻', messages: ['眠いよ〜',            'お昼寝したい',     'ぐっすり寝た'] },
  { id: 12, emoji: '🌊', messages: ['海に行きたい',        '泳ぎたい！',       '波の音好き'] },
  { id: 13, emoji: '🎸', messages: ['練習してた',          '曲書いてる',       'ライブ楽しかった'] },
  { id: 14, emoji: '🦋', messages: ['なんか幸せ',          'ふわふわしてる',   '今日いい日'] },
  { id: 15, emoji: '🌻', messages: ['元気だよ！',          'いい1日だった',    '笑える日最高'] },
  { id: 16, emoji: '🍎', messages: ['お菓子食べた',        'ダイエット中...',  'りんご好き'] },
  { id: 17, emoji: '🎯', messages: ['目標達成！',          'もう少しで',       '集中してる'] },
  { id: 18, emoji: '🌈', messages: ['虹でた！',            '雨あがった',       '今日も平和'] },
  { id: 19, emoji: '🚀', messages: ['新しいこと始めた',    'ワクワクする！',   '挑戦中'] },
  { id: 20, emoji: '💎', messages: ['買い物してた',        'いいもの見つけた', 'セール中！'] },
  { id: 21, emoji: '🎭', messages: ['映画みた！',          '演劇よかった',     '感動した'] },
  { id: 22, emoji: '🦊', messages: ['ひらめいた！',        'キツネかわいい',   'ずる賢くなりたい'] },
  { id: 23, emoji: '🐸', messages: ['雨好き',              'のんびりしてる',   'カエル最高'] },
  { id: 24, emoji: '🌿', messages: ['植物育ててる',        '新芽でた！',       '緑に癒された'] },
  { id: 25, emoji: '🎪', messages: ['お祭りきた',          'イベント楽しい',   '人多い〜'] },
  { id: 26, emoji: '🏄', messages: ['波乗りしてた',        '海最高！',         'サーフィン最高'] },
  { id: 27, emoji: '🌺', messages: ['花きれい',            '写真撮ってた',     '自然って最高'] },
  { id: 28, emoji: '🎨', messages: ['絵描いてた',          '展覧会行った',     'インスタ映え'] },
  { id: 29, emoji: '🦄', messages: ['夢みてた',            'ファンタジーいい', '現実逃避中...'] },
];
*/

// ── タップモーダル関連（bubble/page.tsx BubbleActionMenu と同一デザイン） ──

const REACT_EMOJIS = ['❤️', '😂', '😮', '😢', '👏'] as const;
const ACTION_MENU_W = 264;

// ライブユーザー型（Supabaseから取得した実データ or モックのフォールバック）
interface LivePerson {
  id:       number;   // 配列インデックス（positions/blinkData と対応）
  userId:   string;   // Supabase UUID（プロフィール・DM遷移に使用）
  emoji:    string;
  messages: [string, string, string];
}

interface TapMenu {
  personId:    number;
  personEmoji: string;
  text:        string;
  clientX:     number;
  clientY:     number;
  userId:      string;
}

function TapModal({ menu, onClose }: {
  menu:    TapMenu;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [flyEmoji,      setFlyEmoji]      = useState<{ emoji: string; x: number; y: number } | null>(null);
  const [dmMode,        setDmMode]        = useState(false);
  const [dmText,        setDmText]        = useState('');
  const [dmSending,     setDmSending]     = useState(false);
  const [dmError,       setDmError]       = useState('');
  const [reportMode,    setReportMode]    = useState(false);
  const [reportReason,  setReportReason]  = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportDone,    setReportDone]    = useState(false);

  function handleReact(emoji: string, e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setFlyEmoji({ emoji, x: r.left + r.width / 2, y: r.top });
    setTimeout(onClose, 650);
  }

  // DM ルームを取得 or 新規作成してconvIdを返す
  // 相手が profiles に存在しない場合は 'USER_NOT_FOUND' をスロー
  async function getOrCreateConv(): Promise<string> {
    if (!user) throw new Error('NOT_LOGGED_IN');

    // 相手ユーザーの存在確認（FK 違反を事前に防ぐ）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: targetProfile } = await (supabase as any)
      .from('profiles').select('id').eq('id', menu.userId).maybeSingle();
    if (!targetProfile) throw new Error('USER_NOT_FOUND');

    // 自分が参加している会話IDを取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: myConvIds } = await (supabase as any)
      .from('conversation_members').select('conversation_id').eq('user_id', user.id);
    const myIds: string[] = (myConvIds ?? []).map((r: { conversation_id: string }) => r.conversation_id);

    if (myIds.length > 0) {
      // 相手も参加している会話IDを検索
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: shared } = await (supabase as any)
        .from('conversation_members').select('conversation_id')
        .eq('user_id', menu.userId).in('conversation_id', myIds);
      const sharedIds: string[] = (shared ?? []).map((r: { conversation_id: string }) => r.conversation_id);
      if (sharedIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase as any)
          .from('conversations').select('id').eq('type', 'dm').in('id', sharedIds);
        if (existing && existing.length > 0) return existing[0].id as string;
      }
    }

    // 新規 DM ルーム作成（bubble からの初回DM は pending に設定）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newConv, error: convErr } = await (supabase as any)
      .from('conversations').insert({ type: 'dm', created_by: user.id, status: 'pending' }).select('id').single();
    if (convErr || !newConv) throw new Error('CONV_CREATE_FAILED');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberErr } = await (supabase as any).from('conversation_members').insert([
      { conversation_id: newConv.id, user_id: user.id },
      { conversation_id: newConv.id, user_id: menu.userId },
    ]);
    if (memberErr) throw new Error('MEMBER_INSERT_FAILED');

    return newConv.id as string;
  }

  async function handleSendDM() {
    if (!dmText.trim() || !user || dmSending) return;
    setDmSending(true);
    setDmError('');
    try {
      // 送信前に AI モデレーション（エラー時は送信継続）
      try {
        const modRes = await fetch('/api/moderate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text: dmText.trim(), contentId: 'dm-send', contentType: 'dm' }),
        });
        if (modRes.ok) {
          const modData = await modRes.json() as { flagged: boolean };
          if (modData.flagged) {
            setDmError('このメッセージは送信できません');
            return;
          }
        }
      } catch { /* モデレーションエラーは無視して送信継続 */ }

      const convId = await getOrCreateConv();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('messages').insert({
        conversation_id: convId,
        user_id:         user.id,
        content:         dmText.trim(),
        message_type:    'text',
      });
      if (error) throw new Error('MSG_INSERT_FAILED');
      setDmText('');
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'USER_NOT_FOUND') {
        setDmError('このユーザーにはDMを送れません');
      } else if (msg === 'NOT_LOGGED_IN') {
        setDmError('ログインが必要です');
      } else {
        setDmError('送信に失敗しました');
        console.error('[bubble-v2] handleSendDM error:', e);
      }
    } finally {
      setDmSending(false);
    }
  }

  async function handleSubmitReport() {
    if (!reportReason || reportSending || !user || menu.userId.startsWith('mock-')) return;
    setReportSending(true);
    try {
      const res = await fetch('/api/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId:       menu.userId,
          contentType:     'bubble',
          reason:          reportReason,
          contentSnapshot: menu.text,
          reportedUserId:  menu.userId,
          reporterId:      user.id,
        }),
      });
      if (res.status === 409) { setReportDone(true); return; }
      if (!res.ok) throw new Error('report failed');
      setReportDone(true);
      setTimeout(onClose, 1800);
    } catch (e) {
      console.error('[bubble-v2] report error:', e);
    } finally {
      setReportSending(false);
    }
  }

  // コンテナ（data-bubble-container）の実測 rect を取得
  // position:fixed の子要素はこのコンテナ基準で座標が決まる
  const containerEl = typeof document !== 'undefined'
    ? document.querySelector('[data-bubble-container]')
    : null;
  const containerRect = containerEl
    ? containerEl.getBoundingClientRect()
    : { left: 0, width: typeof window !== 'undefined' ? Math.min(window.innerWidth, 390) : 390, top: 0, height: typeof window !== 'undefined' ? window.innerHeight : 844 };
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const MARGIN = 8;
  const CARD_H = 220;
  // clientX をコンテナ基準ローカル座標に変換（fixedはコンテナ基準のため、containerLeftを足さない）
  const localX = menu.clientX - containerRect.left;
  let left = Math.max(MARGIN, Math.min(localX - ACTION_MENU_W / 2, containerRect.width - ACTION_MENU_W - MARGIN));
  // top: コンテナ top=0 のため clientY がそのままコンテナ基準 Y
  let top = menu.clientY + 14;
  if (top + CARD_H > vh - 20) top = menu.clientY - CARD_H - 14;
  if (top < 56) top = 56;

  return (
    <>
      {/* 透明オーバーレイ */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 28 }} onClick={onClose} />
      {/* リアクション絵文字フライアニメーション */}
      {flyEmoji && (
        <motion.div
          style={{ position: 'fixed', left: flyEmoji.x, top: flyEmoji.y, fontSize: 28, pointerEvents: 'none', zIndex: 200, x: '-50%' }}
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {flyEmoji.emoji}
        </motion.div>
      )}
      {/* カード本体 — バブル近くに表示・画面端を超えない */}
      <div
        style={{
          position:             'fixed',
          top,
          left,
          width:                ACTION_MENU_W,
          zIndex:               29,
          background:           '#0d0d1a',
          border:               '0.5px solid rgba(255,26,26,0.32)',
          borderRadius:         20,
          padding:              '14px',
          boxShadow:            '0 8px 36px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(255,255,255,0.05)',
          backdropFilter:       'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          animation:            'menuPopIn 0.18s cubic-bezier(0.34,1.56,0.64,1) forwards',
          overflow:             'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {dmMode ? (
          /* ── DM入力モード ── */
          <>
            {/* ヘッダー：相手アバター＋バブルテキスト＋✕ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(17,138,178,0.20)', border: '1px solid rgba(17,138,178,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                {menu.personEmoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#118AB2', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {menu.text}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>DM を送る</div>
              </div>
              <button
                onClick={onClose}
                style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
              >✕</button>
            </div>
            {/* エラー表示 */}
            {dmError && (
              <div style={{ fontSize: 11, color: '#FF6B6B', marginBottom: 8, textAlign: 'center' }}>{dmError}</div>
            )}
            {/* 入力ボックス＋送信ボタン */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                value={dmText}
                onChange={e => { setDmText(e.target.value); setDmError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSendDM()}
                placeholder="メッセージを送る..."
                autoFocus
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: `1px solid ${dmError ? 'rgba(255,107,107,0.5)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 20, padding: '9px 14px', fontSize: 13, color: '#fff', outline: 'none', minWidth: 0 }}
              />
              <button
                onClick={handleSendDM}
                disabled={!dmText.trim() || dmSending}
                style={{ width: 36, height: 36, borderRadius: '50%', background: dmText.trim() ? 'linear-gradient(135deg,#118AB2,#7C6FE8)' : 'rgba(255,255,255,0.10)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: dmText.trim() ? 'pointer' : 'default', flexShrink: 0, fontSize: 16, color: '#fff', transition: 'background 0.2s', WebkitTapHighlightColor: 'transparent' }}
              >
                {dmSending ? '…' : '↑'}
              </button>
            </div>
          </>
        ) : (
          /* ── 通常モード ── */
          <>
            {/* ユーザー情報 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,26,26,0.15)', border: '1px solid rgba(255,26,26,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                {menu.personEmoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#FF1A1A', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {menu.text}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', lineHeight: 1.2 }}>バブル</div>
              </div>
            </div>

            {/* リアクション行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              {REACT_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={e => handleReact(emoji, e)}
                  style={{ flex: 1, height: 44, border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, background: 'rgba(255,255,255,0.06)', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transition: 'transform 0.12s ease, background 0.12s ease' }}
                  onPointerEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.13)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.18)'; }}
                  onPointerLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* DM を送る */}
            <button
              onClick={() => setDmMode(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 12, marginBottom: 8, background: 'rgba(17,138,178,0.10)', border: '1px solid rgba(17,138,178,0.22)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxSizing: 'border-box' }}
            >
              <span style={{ fontSize: 15 }}>✉️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#118AB2' }}>DMを送る</span>
            </button>

            {/* プロフィールを見る */}
            <button
              onClick={() => { onClose(); router.push(`/profile/${menu.userId}`); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 12, marginBottom: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxSizing: 'border-box' }}
            >
              <span style={{ fontSize: 15 }}>👤</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>プロフィールを見る</span>
            </button>

            {/* 通報する */}
            {!menu.userId.startsWith('mock-') && (
              <button
                onClick={() => setReportMode(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 12, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.20)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxSizing: 'border-box' }}
              >
                <span style={{ fontSize: 15 }}>🚩</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,100,100,0.90)' }}>通報する</span>
              </button>
            )}
          </>
        )}

        {/* ── 通報モード（カード内で切り替え） ── */}
        {reportMode && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: '#0d0d1a', padding: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,100,100,0.90)' }}>🚩 通報する</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>理由を選択してください</div>
              </div>
              <button onClick={() => { setReportMode(false); setReportReason(''); setReportDone(false); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', fontSize: 11, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>✕</button>
            </div>
            {(['spam', 'inappropriate', 'harassment', 'other'] as const).map((val) => {
              const labels: Record<string, string> = { spam: 'スパム', inappropriate: '不適切なコンテンツ', harassment: '嫌がらせ', other: 'その他' };
              return (
                <button key={val} onClick={() => setReportReason(val)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 6, background: reportReason === val ? 'rgba(255,80,80,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${reportReason === val ? 'rgba(255,80,80,0.45)' : 'rgba(255,255,255,0.10)'}`, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', textAlign: 'left', boxSizing: 'border-box' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${reportReason === val ? '#ff5050' : 'rgba(255,255,255,0.3)'}`, background: reportReason === val ? '#ff5050' : 'transparent', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>{labels[val]}</span>
                </button>
              );
            })}
            {reportDone ? (
              <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 13, color: '#4ade80', fontWeight: 600 }}>✓ 通報を受け付けました</div>
            ) : (
              <button onClick={handleSubmitReport} disabled={!reportReason || reportSending} style={{ width: '100%', padding: '10px 0', borderRadius: 10, marginTop: 4, background: reportReason ? 'rgba(255,80,80,0.85)' : 'rgba(255,255,255,0.10)', border: 'none', fontSize: 13, fontWeight: 700, color: '#fff', cursor: reportReason ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent', opacity: reportSending ? 0.7 : 1 }}>
                {reportSending ? '送信中...' : '通報する'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── 共有コンポーネント ────────────────────────────────────────────────────

// SpeechBubble：bubble/page.tsx BubbleItem の外観をそのまま転用
// isDanger で pururu、isLiked で 👍 ボタンのゴールドグロー
function SpeechBubble({ text, emoji, borderColor, isDanger, isLiked, onReact, onBubbleTap }: {
  text: string; emoji: string; borderColor: string;
  isDanger?: boolean; isLiked?: boolean;
  onReact?: () => void;
  onBubbleTap?: (clientX: number, clientY: number) => void;
}) {
  return (
    <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)', zIndex: 5, whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* バブル本体タップ → モーダル（bubble/page.tsx BubbleItem と同一構造） */}
        <div
          onClick={e => { e.stopPropagation(); onBubbleTap?.(e.clientX, e.clientY); }}
          style={{
            position:             'relative',
            display:              'flex',
            alignItems:           'center',
            gap:                  6,
            padding:              '5px 8px 5px 5px',
            background:           `${borderColor}22`,
            borderRadius:         20,
            border:               `1.5px solid ${borderColor}`,
            boxShadow:            `inset 0 1px 2px rgba(255,255,255,0.15), 0 0 8px ${borderColor}55`,
            animation:            isDanger ? 'pururu 0.4s ease-in-out infinite' : 'none',
            backdropFilter:       'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            overflow:             'hidden',
            cursor:               'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* 光沢ハイライト */}
          <div style={{ position: 'absolute', top: 3, left: 6, width: '25%', height: '50%', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)', pointerEvents: 'none' }} />
          {/* 左端：ミームアイコン */}
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${borderColor}22`, border: `1px solid ${borderColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>
            {emoji}
          </div>
          {/* テキスト */}
          <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 72, letterSpacing: '0.01em' }}>
            {text}
          </span>
          {/* 右端：👍ボタン（タップで即リアクション） */}
          <div
            onClick={e => { e.stopPropagation(); onReact?.(); }}
            style={{
              marginLeft:  2, width: 26, height: 26, borderRadius: '50%',
              background:  isLiked ? 'rgba(255,26,26,0.28)' : 'rgba(255,255,255,0.06)',
              border:      isLiked ? '1px solid rgba(255,26,26,0.60)' : '1px solid rgba(255,255,255,0.14)',
              boxShadow:   isLiked ? '0 0 8px rgba(255,26,26,0.50)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
              cursor: 'pointer', transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            👍
          </div>
        </div>
        {/* バブルの尾 */}
        <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `5px solid ${borderColor}`, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

// PersonCircle：bubble/page.tsx BubbleItem のアニメーション一式を転用
// ・bubbleSpawn（出現）・pururu（危険時震え）・bubblePop + popBurst（消滅）
// ・👍ボタン → 即リアクション / バブル本体 → モーダル / ミーム → モーダル
interface PersonCircleProps {
  emoji: string; size: number; opacity: number;
  floatDuration: number; floatDelay: number;
  messages: [string, string, string];
  x: number; y: number;
  borderColor: string;
  onBubbleTap: (clientX: number, clientY: number, text: string) => void;
  onMemeTap:   (clientX: number, clientY: number) => void;
  onPop:       (x: number, y: number) => void;
  externalBubble?: { text: string; id: string } | null;
}

function PersonCircle({ emoji, size, opacity, floatDuration, floatDelay, messages, x, y, borderColor, onBubbleTap, onMemeTap, onPop, externalBubble }: PersonCircleProps) {
  const activeBubbleRef = useRef<string | null>(null);
  const [isNew,        setIsNew]        = useState(false);
  const [isDanger,     setIsDanger]     = useState(false);
  const [isLiked,      setIsLiked]      = useState(false);
  const [isPopping,    setIsPopping]    = useState(false);
  const [floatEmojis,  setFloatEmojis]  = useState<{ id: number; dx: number; sz: number; delay: number }[]>([]);

  const bubbleWrapperRef = useRef<HTMLDivElement>(null);
  const floatIdRef       = useRef(0);

  // Realtime受信バブルを一時的に表示
  useEffect(() => {
    if (!externalBubble) return;
    activeBubbleRef.current = externalBubble.text;
    setIsNew(true);
    setIsDanger(false);
    const t1 = setTimeout(() => setIsNew(false), 400);
    const t2 = setTimeout(() => { activeBubbleRef.current = null; }, PERSON_BUBBLE_SHOW_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalBubble?.id]);

  // ランダムタイミングでバブルを送信・ライフサイクル管理
  useEffect(() => {
    let sendTimer: ReturnType<typeof setTimeout>;
    let isNewTimer: ReturnType<typeof setTimeout>;
    let dangerTimer: ReturnType<typeof setTimeout>;
    let popTimer: ReturnType<typeof setTimeout>;
    let clearTimer: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      sendTimer = setTimeout(() => {
        const msg = messages[Math.floor(Math.random() * messages.length)];
        activeBubbleRef.current = msg;
        setIsNew(true);
        isNewTimer = setTimeout(() => setIsNew(false), 400);
        // 表示から2〜6秒のランダムタイミングでポップ
        const showMs = 2000 + Math.random() * 4000;
        const dangerStartMs = showMs - DANGER_THRESHOLD * 1000;
        if (dangerStartMs > 0) {
          dangerTimer = setTimeout(() => setIsDanger(true), dangerStartMs);
        }
        popTimer = setTimeout(() => {
          const el = bubbleWrapperRef.current;
          if (el) {
            el.style.animation = 'bubbleFade 0.3s ease-out forwards';
          }
          // バブル位置でパーティクルバーストを発動（el の有無に関わらず常に実行）
          onPop(x, y - size / 2);
          clearTimer = setTimeout(() => {
            activeBubbleRef.current = null;
            setIsDanger(false);
            if (el) el.style.animation = '';
            scheduleNext();
          }, 400);
        }, showMs - 400);
      }, PERSON_BUBBLE_MIN_MS + Math.random() * PERSON_BUBBLE_RANGE_MS);
    }

    const initTimer = setTimeout(scheduleNext, Math.random() * 12000);
    return () => {
      [initTimer, sendTimer, isNewTimer, dangerTimer, popTimer, clearTimer]
        .forEach(t => clearTimeout(t));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 👍 即リアクション（bubble/page.tsx handleQuickLike と同一）
  function handleReact() {
    setIsLiked(true);
    setTimeout(() => setIsLiked(false), 500);
    const newEmojis = Array.from({ length: 3 }, (_, i) => ({
      id: floatIdRef.current++, dx: (Math.random() - 0.5) * 24,
      sz: 16 + Math.random() * 8, delay: i * 60,
    }));
    setFloatEmojis(prev => [...prev, ...newEmojis]);
    const ids = new Set(newEmojis.map(e => e.id));
    setTimeout(() => setFloatEmojis(prev => prev.filter(e => !ids.has(e.id))), 1400);
  }

  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, opacity }}>
      <motion.div
        animate={{ y: -15, scale: isPopping ? 0 : 1, opacity: isPopping ? 0 : 1 }}
        transition={isPopping ? { duration: 0.4, ease: 'easeIn' } : { duration: floatDuration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: floatDelay }}
        style={{ position: 'relative', width: size, height: size }}
      >
        {/* バブル（アクティブ時のみ）— ref で bubblePop を直接適用 */}
        {activeBubbleRef.current && (
          <div ref={bubbleWrapperRef}>
            <div style={{
              animation:  isNew ? 'bubbleSpawn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
              filter:     isDanger ? 'drop-shadow(0 0 8px rgba(255,255,255,0.9))' : 'none',
              transition: 'filter 0.3s ease',
            }}>
              <SpeechBubble
                text={activeBubbleRef.current} emoji={emoji}
                borderColor={borderColor} isDanger={isDanger} isLiked={isLiked}
                onReact={handleReact}
                onBubbleTap={(cx, cy) => onBubbleTap(cx, cy, activeBubbleRef.current!)}
              />
            </div>
          </div>
        )}

        {/* emojiFloat */}
        {floatEmojis.map(fe => (
          <div key={fe.id} style={{ position: 'absolute', left: size / 2 + fe.dx, top: -size * 0.3, fontSize: fe.sz, pointerEvents: 'none', zIndex: 20, animation: `emojiFloat 1.2s ${fe.delay}ms ease-out forwards` }}>
            👍
          </div>
        ))}

        {/* ミームアイコン円（タップ → モーダル DM/プロフィール） */}
        <div
          onClick={e => { e.stopPropagation(); onMemeTap(e.clientX, e.clientY); }}
          style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.48, boxShadow: '0 2px 10px rgba(0,0,0,0.3)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          {emoji}
        </div>
      </motion.div>
    </div>
  );
}

// ── 自分バブル（bubble/page.tsx の BubbleItem デザインをそのまま転用） ──

interface SelfBubbleViewProps {
  text:        string;
  danger:      boolean;
  divRef:      React.RefObject<HTMLDivElement | null>;
  cx:          number;
  cy:          number;
  selfSize:    number;
  borderColor: string;
  textColor:   string;
}

function SelfBubbleView({ text, danger, divRef, cx, cy, selfSize, borderColor, textColor }: SelfBubbleViewProps) {
  const [isNew, setIsNew] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsNew(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={divRef}
      style={{
        position:  'absolute',
        left:      cx,
        top:       cy - selfSize / 2 - 6,
        transform: 'translateX(-50%) translateY(-100%)',
        zIndex:    4,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{
        animation:  isNew ? 'bubbleSpawn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
        filter:     danger ? 'drop-shadow(0 0 8px rgba(255,255,255,0.9))' : 'none',
        transition: 'filter 0.3s ease',
      }}>
        {/* バブル本体 (ラッパー: 枠線グラデーション) */}
        <div style={{
          display:    'inline-flex',
          borderRadius: 21.5,
          padding:    1.5,
          background: borderColor === 'rainbow'
            ? 'linear-gradient(135deg, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8, #7C6FE8)'
            : borderColor,
          boxShadow:  borderColor === 'rainbow'
            ? '0 0 8px rgba(124,111,232,0.5)'
            : `0 0 8px ${borderColor}44`,
          animation:  danger ? 'pururu 0.4s ease-in-out infinite' : 'none',
        }}>
          <div style={{
            position:             'relative',
            display:              'flex',
            alignItems:           'center',
            gap:                  6,
            padding:              '5px 10px',
            background:           'rgba(10,10,26,0.55)',
            borderRadius:         20,
            backdropFilter:       'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            overflow:             'hidden',
            maxWidth:             160,
            whiteSpace:           'nowrap',
            boxShadow:            'inset 0 1px 2px rgba(255,255,255,0.15)',
          }}>
            {/* 光沢ハイライト */}
            <div style={{ position: 'absolute', top: 3, left: 6, width: '25%', height: '50%', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)', pointerEvents: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.01em' }}>
              {text}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STEP 1: ミーム生成画面 ───────────────────────────────────────────────

function CreateScreen({ onConfirm, onBack }: { onConfirm: (url: string) => void; onBack?: () => void }) {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const [showOpps,    setShowOpps]    = useState(false);
  const [oppsMessage, setOppsMessage] = useState('');

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setGenerated(null);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleGenerate() {
    if (!file || loading) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res  = await fetch('/api/generate-meme', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) setGenerated(data.url);
      else { setOppsMessage(data.error ?? '生成に失敗しました'); setShowOpps(true); }
    } catch {
      setOppsMessage('通信エラーが発生しました'); setShowOpps(true);
    } finally {
      setLoading(false);
    }
  }

  const CIRCLE     = 148;
  const displaySrc = generated ?? preview;
  const canGenerate = !!file && !loading && !generated;

  return (
    <div style={{ position: 'relative', height: '100dvh', background: '#0a0a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', gap: 28, overflow: 'hidden' }}>
      {/* ── Opps! モーダル ── */}
      {showOpps && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div style={{ background: '#1a1a2e', border: '2px solid #FF1A1A', borderRadius: 20, padding: '32px 24px', textAlign: 'center', maxWidth: 300, width: '80%' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#FF1A1A', marginBottom: 8 }}>Opps!</div>
            <div style={{ color: '#fff', fontSize: 14, marginBottom: 24 }}>{oppsMessage}</div>
            <button onClick={() => setShowOpps(false)} style={{ background: '#FF1A1A', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 32px', fontWeight: 'bold', fontSize: 16, cursor: 'pointer' }}>
              見直す
            </button>
          </div>
        </div>
      )}
      {onBack && (
        <button
          onClick={onBack}
          style={{ position: 'absolute', top: 20, left: 20, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 24, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          ←
        </button>
      )}
      <SyncLogo width={96} />

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>あなたのミームを作ろう</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 6 }}>
          {generated ? '生成完了！確認してください' : '写真からBitmoji風アイコンを生成します'}
        </div>
      </div>

      <div style={{ position: 'relative', width: CIRCLE, height: CIRCLE }}>
        <button
          onClick={() => !loading && !generated && fileInputRef.current?.click()}
          style={{ width: CIRCLE, height: CIRCLE, borderRadius: '50%', border: displaySrc ? (generated ? '3px solid rgba(124,111,232,0.8)' : '2.5px solid rgba(255,255,255,0.35)') : '2px dashed rgba(124,111,232,0.5)', background: displaySrc ? 'transparent' : 'rgba(124,111,232,0.10)', cursor: loading || generated ? 'default' : 'pointer', overflow: 'hidden', padding: 0, WebkitTapHighlightColor: 'transparent', boxShadow: generated ? '0 0 32px rgba(124,111,232,0.55), 0 0 64px rgba(124,111,232,0.2)' : displaySrc ? '0 0 16px rgba(255,255,255,0.12)' : 'none', transition: 'box-shadow 0.4s, border 0.4s' }}
        >
          {displaySrc ? (
            <img src={displaySrc} alt="プレビュー" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
              <span style={{ fontSize: 40 }}>📷</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>写真を選ぶ</span>
            </div>
          )}
        </button>

        {loading && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(10,10,26,0.65)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 28, animation: 'spin 1.4s linear infinite', display: 'inline-block' }}>✨</span>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>生成中...</span>
          </div>
        )}

        {preview && !generated && !loading && (
          <button onClick={() => fileInputRef.current?.click()} style={{ position: 'absolute', bottom: 4, right: 4, width: 34, height: 34, borderRadius: '50%', background: 'rgba(124,111,232,0.88)', border: '2.5px solid #0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
            ✏️
          </button>
        )}

        {generated && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} style={{ position: 'absolute', bottom: 4, right: 4, width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#7C6FE8,#D455A8)', border: '2.5px solid #0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 2px 8px rgba(124,111,232,0.5)', color: '#fff' }}>
            ✓
          </motion.div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
        <AnimatePresence mode="wait">
          {generated ? (
            <motion.button key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => onConfirm(generated)} style={{ height: 52, borderRadius: 26, border: 'none', background: 'linear-gradient(135deg,#7C6FE8,#D455A8)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 24px rgba(124,111,232,0.45)', letterSpacing: '0.03em' }}>
              これにする →
            </motion.button>
          ) : (
            <motion.button key="generate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={handleGenerate} disabled={!canGenerate} style={{ height: 52, borderRadius: 26, border: 'none', background: canGenerate ? 'linear-gradient(135deg,#7C6FE8,#D455A8)' : 'rgba(255,255,255,0.09)', color: canGenerate ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: 700, cursor: canGenerate ? 'pointer' : 'default', boxShadow: canGenerate ? '0 0 20px rgba(124,111,232,0.35)' : 'none', transition: 'all 0.25s', letterSpacing: '0.02em' }}>
              {loading ? '⏳　生成中...' : 'ミームを生成する'}
            </motion.button>
          )}
        </AnimatePresence>

        {generated && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => { setGenerated(null); setPreview(null); setFile(null); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.38)', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
            やり直す
          </motion.button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSelect} style={{ display: 'none' }} />

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── STEP 2: バブル画面 ───────────────────────────────────────────────────

interface PopBurst {
  id: string; x: number; y: number;
  particles: { id: number; dx: string; dy: string; size: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BubbleScreen({ selfImage, onChangeMeme, user, profile: _profile, myBubbleColor, bubbleTextColor }: { selfImage: string; onChangeMeme: () => void; user: any; profile: any; myBubbleColor: string; bubbleTextColor: string }) {
  // 時間帯
  const [tod, setTod] = useState<ToD>(() => getToD(new Date().getHours()));

  // 星・大気（クライアントサイドのみ生成、bubble/page.tsx と同一）
  const MICRO  = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ id: i,     left: (Math.sin(i*7.391)*0.5+0.5)*100, top: (Math.sin(i*3.714+1.2)*0.5+0.5)*90, size: 0.5+(i%3)*0.18,  op: 0.10+(i%8)*0.05,  dur: 4+(i%7)*0.7,   delay: (i%17)*0.31 })), []);
  const NORMAL = useMemo(() => Array.from({ length: 50 }, (_, i) => ({ id: 100+i, left: (Math.sin(i*5.123+0.5)*0.5+0.5)*100, top: (Math.sin(i*2.841+2.8)*0.5+0.5)*88, size: 1+(i%4)*0.32,   op: 0.32+(i%6)*0.09, dur: 2.8+(i%9)*0.42, delay: (i%11)*0.42 })), []);
  const BRIGHT = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ id: 155+i, left: (Math.sin(i*9.432+1.8)*0.5+0.5)*100, top: (Math.sin(i*4.567+0.3)*0.5+0.5)*80, size: 1.9+(i%4)*0.38, op: 0.6+(i%4)*0.08,  dur: 2.2+(i%8)*0.35, delay: (i%13)*0.52 })), []);
  const NEBULA = useMemo(() => Array.from({ length: 6  }, (_, i) => ({ id: i, left: (Math.sin(i*4.123+0.7)*0.5+0.5)*100, top: (Math.sin(i*2.987+1.4)*0.5+0.5)*85, size: 90+(i%4)*62, color: ['rgba(70,30,160,0.055)','rgba(30,18,110,0.045)','rgba(90,50,190,0.06)','rgba(18,25,100,0.05)','rgba(50,18,130,0.045)','rgba(70,50,190,0.065)'][i] })), []);
  const CLOUDS = useMemo(() => Array.from({ length: 7  }, (_, i) => ({ id: i, left: (Math.sin(i*6.28+0.4)*0.5+0.5)*100, top: 20+(Math.sin(i*3.14+1.1)*0.5+0.5)*55, w: 100+(i%4)*55, h: 26+(i%3)*12 })), []);

  const [showOpps,    setShowOpps]    = useState(false);
  const [oppsMessage, setOppsMessage] = useState('');

  // ライブユーザーデータ（profiles から実ユーザーを取得）
  const [livePeople, setLivePeople] = useState<LivePerson[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // 1. profiles から自分以外を最大29人取得
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profilesData, error: profErr } = await (supabase as any)
          .from('profiles')
          .select('id, username, display_name')
          .neq('id', user.id)
          .limit(29);

        if (profErr) { console.error('[bubble-v2] profiles fetch error:', profErr); return; }
        if (!profilesData || profilesData.length === 0) return;

        // 2. 各ユーザーの有効期限内バブルを最新順で取得（メッセージとして使用）
        const userIds = (profilesData as Array<{ id: string }>).map(p => p.id);
        const now = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bubblesData } = await (supabase as any)
          .from('bubbles')
          .select('user_id, content')
          .in('user_id', userIds)
          .gt('expires_at', now)
          .order('created_at', { ascending: false })
          .limit(200);

        // user_id → コンテンツ配列
        const bubblesByUser: Record<string, string[]> = {};
        for (const b of (bubblesData ?? []) as Array<{ user_id: string; content: string }>) {
          if (!bubblesByUser[b.user_id]) bubblesByUser[b.user_id] = [];
          if (bubblesByUser[b.user_id].length < 3) bubblesByUser[b.user_id].push(b.content);
        }

        // 3. LivePerson 配列に変換
        const people: LivePerson[] = (profilesData as Array<{ id: string; username: string | null; display_name: string | null }>)
          .map((prof, i) => {
            const fallbackName = prof.display_name || prof.username || '...';
            const msgs = [...(bubblesByUser[prof.id] ?? [])];
            while (msgs.length < 3) msgs.push(fallbackName);
            return {
              id:       i,
              userId:   prof.id,
              emoji:    EMOJI_POOL[i % EMOJI_POOL.length],
              messages: msgs.slice(0, 3) as [string, string, string],
            };
          });

        setLivePeople(people);
      } catch (e) {
        console.error('[bubble-v2] livePeople fetch error:', e);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 自分バブル
  const [selfBubble,       setSelfBubble]       = useState<{ id: string; text: string } | null>(null);
  const [selfBubbleDanger, setSelfBubbleDanger] = useState(false);
  const [popBursts,        setPopBursts]        = useState<PopBurst[]>([]);
  const selfBubbleElRef = useRef<HTMLDivElement>(null);
  const dangerTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 既存 state
  const [inputText, setInputText] = useState('');
  const [fieldSize, setFieldSize] = useState({ w: 0, h: 0 });
  const fieldRef = useRef<HTMLDivElement>(null);

  // キーボード高さ追従
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const diff = window.innerHeight - window.visualViewport.height;
        setKeyboardHeight(diff > 0 ? diff : 0);
      }
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // BottomNav の実測高さ
  const navHeight = 80;

  const blinkData = useRef(Array.from({ length: 29 }, makeFloatData));

  // 時間帯（1分ごと更新）
  useEffect(() => {
    const id = setInterval(() => setTod(getToD(new Date().getHours())), 60_000);
    return () => clearInterval(id);
  }, []);

  // ResizeObserver
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth || window.innerWidth;
      const h = el.offsetHeight || window.innerHeight;
      setFieldSize({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // フォールバック：100ms後に再取得
    const t = setTimeout(update, 100);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, []);


  // 自分ミームのアニメーション
  const selfFloatData = useRef(makeFloatData()).current;

  // Realtimeで受信した他人バブル（PersonCircle index → bubble）
  const [receivedBubbles, setReceivedBubbles] = useState<Record<number, { text: string; id: string } | null>>({});

  // タップモーダル
  const [tapMenu, setTapMenu] = useState<TapMenu | null>(null);

  // 実データがあれば使用、なければリアルなモックフォールバック
  const MOCK_FALLBACK: LivePerson[] = [
    { id:  0, userId: 'mock-1',  emoji: '😴', messages: ['眠れない',         '夜型すぎる',       '明日やばい'] },
    { id:  1, userId: 'mock-2',  emoji: '🎤', messages: ['誰かカラオケ行かない？', 'ひとりカラオケ最高', '声出しすぎた'] },
    { id:  2, userId: 'mock-3',  emoji: '☕', messages: ['コーヒー飲みすぎた', 'カフェにいる',      '眠気消えない'] },
    { id:  3, userId: 'mock-4',  emoji: '🍜', messages: ['お腹すいた',         'ラーメン食べたい',  '深夜飯はやばい'] },
    { id:  4, userId: 'mock-5',  emoji: '📚', messages: ['勉強したくない',     'レポートやばい',   '現実逃避中'] },
    { id:  5, userId: 'mock-6',  emoji: '🎬', messages: ['映画見たい',         'Netflixどれ見る？', 'おすすめ教えて'] },
    { id:  6, userId: 'mock-7',  emoji: '🌙', messages: ['今日暇すぎる',       '何してる？',        '誰かいる？'] },
    { id:  7, userId: 'mock-8',  emoji: '🎵', messages: ['推しのライブ最高だった', '神曲きた',      'ずっと聴いてる'] },
    { id:  8, userId: 'mock-9',  emoji: '🚶', messages: ['散歩してる',         '夜風気持ちいい',    'どこ歩こう'] },
    { id:  9, userId: 'mock-10', emoji: '🐱', messages: ['猫なでたい',         'ねこカフェ行きたい', 'もふもふ恋しい'] },
    { id: 10, userId: 'mock-11', emoji: '🍕', messages: ['ピザ食べたい',       '一人で頼むの多い？', 'チーズ最強'] },
    { id: 11, userId: 'mock-12', emoji: '🌸', messages: ['春眠い',             '花粉つらい',        '外出たくない'] },
    { id: 12, userId: 'mock-13', emoji: '🎮', messages: ['ゲームしよ',         '対戦相手いない？',  'クリアできん'] },
    { id: 13, userId: 'mock-14', emoji: '🏃', messages: ['走ってきた',         '筋肉痛やばい',      '明日もがんばる'] },
    { id: 14, userId: 'mock-15', emoji: '🌃', messages: ['夜景きれい',         'ひとりでいる',      'なんか感傷的'] },
    { id: 15, userId: 'mock-16', emoji: '🍦', messages: ['アイス食べたい',     '夜中のスイーツ罪悪感', 'まあいっか'] },
    { id: 16, userId: 'mock-17', emoji: '📱', messages: ['SNS見すぎた',        '目が疲れた',        'デジタルデトックスしたい'] },
    { id: 17, userId: 'mock-18', emoji: '🎸', messages: ['弾き語りしたい',     '曲作ってる',        'スタジオ行きたい'] },
    { id: 18, userId: 'mock-19', emoji: '🌊', messages: ['海行きたい',         '波の音聞きたい',    '夏早く来て'] },
    { id: 19, userId: 'mock-20', emoji: '✨', messages: ['なんかいい日だった', 'ちょっと幸せ',      '今日に感謝'] },
  ];
  const displayPeople: LivePerson[] = livePeople.length > 0 ? livePeople : MOCK_FALLBACK;

  function openModal(p: LivePerson, clientX: number, clientY: number, text: string) {
    setTapMenu({ personId: p.id, personEmoji: p.emoji, text, clientX, clientY, userId: p.userId });
  }

  // ReactionFloatingEffect 用（bubble/page.tsx と同一）
  const [postCount, setPostCount] = useState(0);

  // Realtime: 他ユーザーのバブルをリアルタイム受信
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('bubbles-realtime-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bubbles' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = (payload.new as any);
          if (row.user_id === user.id) return;
          if (row.expires_at && new Date(row.expires_at) < new Date()) return;

          const idx = Math.floor(Math.random() * EMOJI_POOL.length);
          const rid = makeId();
          setReceivedBubbles(prev => ({ ...prev, [idx]: { text: row.content, id: rid } }));
          setTimeout(() => setReceivedBubbles(prev => {
            const next = { ...prev };
            if (next[idx]?.id === rid) next[idx] = null;
            return next;
          }), PERSON_BUBBLE_SHOW_MS + 500);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // アンマウント時タイマークリーンアップ
  useEffect(() => {
    return () => {
      if (dangerTimerRef.current) clearTimeout(dangerTimerRef.current);
      if (popTimerRef.current)    clearTimeout(popTimerRef.current);
    };
  }, []);

  const TOD_INPUT_TEXT: Record<ToD, string> = {
    morning: 'rgba(20,20,40,0.9)',
    day:     'rgba(10,10,30,0.9)',
    evening: 'rgba(255,255,255,0.95)',
    night:   'rgba(255,255,255,0.95)',
  };
  const inputTextColor = TOD_INPUT_TEXT[tod];

  const { w, h } = fieldSize;

  // ── バブル発射 ───────────────────────────────────────────────────────────

  function triggerPopBurst(x: number, y: number) {
    const burstId   = makeId();
    const particles = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const dist  = 20 + Math.random() * 30;
      return { id: i, dx: (Math.cos(angle) * dist).toFixed(1) + 'px', dy: (Math.sin(angle) * dist).toFixed(1) + 'px', size: 3 + Math.random() * 3 };
    });
    setPopBursts(prev => [...prev, { id: burstId, x, y, particles }]);
    setTimeout(() => setPopBursts(prev => prev.filter(b => b.id !== burstId)), 700);
  }

  async function handleSend() {
    if (!inputText.trim()) return;
    const text     = inputText.trim();
    const bubbleId = makeId();

    // AIスキャン（ブロック判定）
    try {
      const scanRes = await fetch('/api/scan-post', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });
      const { blocked, reason } = await scanRes.json();
      if (blocked) {
        setOppsMessage(reason || '他者への攻撃的表現');
        setShowOpps(true);
        return;
      }
    } catch (e) {
      console.error('[bubbleScan] スキャンエラー:', e);
    }

    setInputText('');

    if (dangerTimerRef.current) clearTimeout(dangerTimerRef.current);
    if (popTimerRef.current)    clearTimeout(popTimerRef.current);
    setSelfBubbleDanger(false);
    setSelfBubble({ id: bubbleId, text });

    dangerTimerRef.current = setTimeout(
      () => setSelfBubbleDanger(true),
      (BUBBLE_LIFETIME - DANGER_THRESHOLD) * 1000,
    );

    setPostCount(n => n + 1);

    popTimerRef.current = setTimeout(() => {
      const el    = selfBubbleElRef.current;
      const field = fieldRef.current;
      if (el) {
        el.style.animation     = 'bubbleFade 0.3s ease-out forwards';
        el.style.pointerEvents = 'none';
        if (field) triggerPopBurst(field.offsetWidth / 2, field.offsetHeight / 2 - SELF_SIZE / 2);
      }
      setTimeout(() => {
        setSelfBubble(prev => prev?.id === bubbleId ? null : prev);
        setSelfBubbleDanger(false);
      }, 350);
    }, BUBBLE_LIFETIME * 1000);

    // Supabaseに保存（ログイン済みのみ）
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileGps } = await (supabase as any)
        .from('profiles')
        .select('lat, lng')
        .eq('id', user.id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('bubbles') as any).insert({
        user_id:            user.id,
        content:            text,
        hashtags:           [],
        color:              null,
        session_id:         null,
        is_offline_created: false,
        expires_at:         new Date(Date.now() + BUBBLE_LIFETIME * 1000).toISOString(),
        lat:                profileGps?.lat ?? null,
        lng:                profileGps?.lng ?? null,
        radius:             50,
      });
      if (error) console.error('[bubble-v2] insert error:', error);
    }
  }

  const SELF_SIZE = 68;
  const ready     = w > 0 && h > 0;
  const cx = w / 2;
  const cy = h / 2;

  const positions = useMemo(() => {
    // dragConstraints ±300、PADDING=30 → 配置範囲 ±270 をビューポート中心基準で設定
    const DRAG       = 300;
    const PADDING    = 30;
    const MIN_DIST_SELF  = 160;
    const MIN_DIST_OTHER = 75;
    const MAX_TRIES  = 200;
    const result: { x: number; y: number; ring: 1 | 2 }[] = [];

    // 配置可能領域: viewport中心(cx,cy)を基準に ±(DRAG-PADDING) = ±270
    const rangeX = DRAG - PADDING; // 270
    const rangeY = DRAG - PADDING; // 270
    const xMin = cx - rangeX;
    const xMax = cx + rangeX;
    const yMin = cy - rangeY;
    const yMax = cy + rangeY;

    for (let i = 0; i < 29; i++) {
      for (let t = 0; t < MAX_TRIES; t++) {
        const x = xMin + Math.random() * (xMax - xMin);
        const y = yMin + Math.random() * (yMax - yMin);
        if (Math.hypot(x - cx, y - cy) < MIN_DIST_SELF) continue;
        if (result.some(p => Math.hypot(p.x - x, p.y - y) < MIN_DIST_OTHER)) continue;
        result.push({ x, y, ring: (i < 10 ? 1 : 2) as 1 | 2 });
        break;
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0a0a1a' }}>
      {/* ── Opps! モーダル ── */}
      {showOpps && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div style={{ background: '#1a1a2e', border: '2px solid #FF1A1A', borderRadius: 20, padding: '32px 24px', textAlign: 'center', maxWidth: 300, width: '80%' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#FF1A1A', marginBottom: 8 }}>Opps!</div>
            <div style={{ color: '#fff', fontSize: 14, marginBottom: 24 }}>{oppsMessage}</div>
            <button onClick={() => setShowOpps(false)} style={{ background: '#FF1A1A', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 32px', fontWeight: 'bold', fontSize: 16, cursor: 'pointer' }}>
              見直す
            </button>
          </div>
        </div>
      )}

      {/* ── 時間帯背景（bubble/page.tsx と同一） ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, background: TIME_BG[tod] }} />
        {tod === 'morning' && <>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 55% at 50% 90%,rgba(255,200,100,0.30) 0%,transparent 70%)' }} />
          {CLOUDS.map(c => <div key={c.id} style={{ position: 'absolute', left: `${c.left}%`, top: `${c.top}%`, width: c.w, height: c.h, borderRadius: '50%', background: 'rgba(255,250,240,0.26)', filter: 'blur(18px)' }} />)}
        </>}
        {tod === 'day' && <>
          <div style={{ position: 'absolute', inset: '0 0 60% 0', background: 'linear-gradient(180deg,rgba(20,80,160,0.32) 0%,transparent 100%)' }} />
          {CLOUDS.map(c => <div key={c.id} style={{ position: 'absolute', left: `${c.left}%`, top: `${c.top}%`, width: c.w, height: c.h, borderRadius: '50%', background: 'rgba(255,255,255,0.20)', filter: 'blur(22px)' }} />)}
        </>}
        {tod === 'evening' && <>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 60% at 50% 85%,rgba(240,90,30,0.36) 0%,transparent 65%)' }} />
          <div style={{ position: 'absolute', inset: '0 0 75% 0', background: 'linear-gradient(180deg,rgba(60,10,120,0.32) 0%,transparent 100%)' }} />
        </>}
        {tod === 'night' && <>
          {NEBULA.map(nb => <div key={nb.id} style={{ position: 'absolute', left: `${nb.left}%`, top: `${nb.top}%`, width: nb.size, height: nb.size, borderRadius: '50%', background: nb.color, filter: 'blur(38px)', transform: 'translate(-50%,-50%)' }} />)}
          <div style={{ position: 'absolute', inset: '60% 0 0 0', background: 'linear-gradient(transparent,rgba(1,1,8,0.55))' }} />
          {CLOUDS.map(c => <div key={c.id} style={{ position: 'absolute', left: `${c.left}%`, top: `${c.top}%`, width: c.w, height: c.h, borderRadius: '50%', background: 'rgba(20,10,60,0.18)', filter: 'blur(28px)' }} />)}
          {MICRO.map(s  => <div key={s.id}  style={{ position: 'absolute', left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, borderRadius: '50%', background: '#fff', ['--star-op' as string]: s.op, animation: `starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }} />)}
          {NORMAL.map(s => <div key={s.id}  style={{ position: 'absolute', left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, borderRadius: '50%', background: '#fff', boxShadow: `0 0 ${s.size*1.5}px rgba(255,255,255,${(s.op*0.6).toFixed(2)})`, ['--star-op' as string]: s.op, animation: `starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }} />)}
          {BRIGHT.map(s => <div key={s.id}  style={{ position: 'absolute', left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, borderRadius: '50%', background: '#fff', boxShadow: `0 0 ${s.size*2.5}px rgba(255,255,255,${(s.op*0.8).toFixed(2)}),0 0 ${s.size*5}px rgba(200,220,255,${(s.op*0.3).toFixed(2)})`, ['--star-op' as string]: s.op, animation: `starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }} />)}
        </>}
      </div>

      {/* ── ヘッダー ── */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', zIndex: 100 }}>
        <SyncLogo width={100} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
          </div>
          <button
            onClick={onChangeMeme}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: 'rgba(255,255,255,0.32)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.02em' }}
          >
            ミームを変更
          </button>
        </div>
      </div>

      {/* ── フィールド ── */}
      <div ref={fieldRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 10 }}>
        {ready && (
          <motion.div
            drag
            dragConstraints={{ top: -300, bottom: 300, left: -300, right: 300 }}
            dragElastic={0.05}
            dragMomentum={true}
            style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
          >
            {/* 住人（実データ or モックフォールバック） */}
            {displayPeople.map((p, i) => {
              const pos         = positions[i];
              if (!pos) return null;
              const size        = pos.ring === 1 ? 56 : 38;
              const opacity     = pos.ring === 1 ? 0.88 : 0.62;
              const bd          = blinkData.current[i];
              const borderColor = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
              return (
                <PersonCircle key={p.userId} emoji={p.emoji}
                  size={size} opacity={opacity}
                  floatDuration={bd.floatDuration} floatDelay={bd.floatDelay}
                  messages={p.messages}
                  x={pos.x} y={pos.y}
                  borderColor={borderColor}
                  onBubbleTap={(cx, cy, text) => openModal(p, cx, cy, text)}
                  onMemeTap={(cx, cy) => openModal(p, cx, cy, p.messages[0])}
                  onPop={(bx, by) => triggerPopBurst(bx, by)}
                  externalBubble={receivedBubbles[i] ?? null}
                />
              );
            })}

            {/* 自分（中央） */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0 }}
              style={{ position: 'absolute', left: cx - SELF_SIZE/2, top: cy - SELF_SIZE/2, width: SELF_SIZE, height: SELF_SIZE, zIndex: 3 }}
            >
              <motion.div
                animate={{ y: -15 }}
                transition={{ duration: selfFloatData.floatDuration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: selfFloatData.floatDelay + 0.6 }}
                style={{ position: 'relative', width: SELF_SIZE, height: SELF_SIZE, borderRadius: '50%', overflow: 'hidden', border: myBubbleColor === 'transparent' ? 'none' : '2.5px solid transparent', backgroundImage: myBubbleColor === 'rainbow' ? 'linear-gradient(#0a0a1a, #0a0a1a), linear-gradient(135deg, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8, #7C6FE8)' : 'none', backgroundOrigin: myBubbleColor === 'rainbow' ? 'border-box' : undefined, backgroundClip: myBubbleColor === 'rainbow' ? 'padding-box, border-box' : undefined, outline: myBubbleColor !== 'rainbow' && myBubbleColor !== 'transparent' ? `2.5px solid ${myBubbleColor}` : 'none', outlineOffset: '-2.5px', boxShadow: '0 0 24px rgba(124,111,232,0.6), 0 0 48px rgba(124,111,232,0.2)' }}
              >
                {selfImage ? <img src={selfImage} alt="自分のミーム" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </motion.div>
            </motion.div>

            {/* 自分バブル */}
            {selfBubble && (
              <SelfBubbleView
                key={selfBubble.id}
                text={selfBubble.text}
                danger={selfBubbleDanger}
                divRef={selfBubbleElRef}
                cx={cx}
                cy={cy}
                selfSize={SELF_SIZE}
                borderColor={myBubbleColor}
                textColor={bubbleTextColor}
              />
            )}

          </motion.div>
        )}
      </div>

      {/* ── タップモーダル ── */}
      {tapMenu && (
        <TapModal
          menu={tapMenu}
          onClose={() => setTapMenu(null)}
        />
      )}

      {/* ── パチン！パーティクル（bubble/page.tsx と同一） ── */}
      {popBursts.map(pb => (
        <div key={pb.id} style={{ position: 'absolute', left: pb.x, top: pb.y, pointerEvents: 'none', zIndex: 110 }}>
          {pb.particles.map(p => (
            <div key={p.id} style={{ position: 'absolute', width: p.size, height: p.size, borderRadius: '50%', background: '#7C6FE8', boxShadow: `0 0 ${p.size*2}px #7C6FE8`, top: -p.size/2, left: -p.size/2, ['--pdx' as string]: p.dx, ['--pdy' as string]: p.dy, animation: 'popParticle 600ms ease-out forwards' }} />
          ))}
        </div>
      ))}

      {/* ── 入力欄（キーボードが出ても固定） ── */}
      <div style={{ position: 'fixed', bottom: keyboardHeight > 0 ? keyboardHeight : navHeight, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390, zIndex: 200, background: 'transparent', transition: 'bottom 0.25s ease' }}>
        {/* 入力欄 */}
        <div style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 22, padding: '8px 12px 8px 14px', background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1.5px solid transparent', backgroundImage: myBubbleColor === 'rainbow' ? 'linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10)), linear-gradient(135deg, #7C6FE8, #D455A8, #E84040, #E8A020, #48C468, #2890D8, #7C6FE8)' : `linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10)), linear-gradient(${myBubbleColor}, ${myBubbleColor})`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box', boxShadow: myBubbleColor === 'rainbow' ? '0 0 12px rgba(124,111,232,0.4)' : `0 0 12px ${myBubbleColor}66` }}>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="今どうしてる？..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: inputTextColor, ['--placeholder-color' as string]: tod === 'morning' || tod === 'day' ? 'rgba(10,10,30,0.4)' : 'rgba(255,255,255,0.28)' }}
              />
              <span style={{ fontSize: 11, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: inputText.length >= MAX_CHARS ? '#e63946' : 'rgba(255,255,255,0.28)' }}>
                {MAX_CHARS - inputText.length}
              </span>
            </div>
            {/* 送信ボタン（bubble/page.tsx と同一デザイン） */}
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.6)', cursor: inputText.trim() ? 'pointer' : 'default', background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.1)), linear-gradient(135deg, #FF6B6B, #FF8E53, #FFD93D, #6BCB77, #4D96FF, #9B59B6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, boxShadow: '0 4px 15px rgba(150,100,255,0.4), inset 0 1px 0 rgba(255,255,255,0.6)', opacity: inputText.trim() ? 1 : 0.35, fontSize: 18, WebkitTapHighlightColor: 'transparent' }}
            >
              🫧
            </button>
          </div>
        </div>
      </div>

      {/* ── CSS（bubble/page.tsx から転用） ── */}
      <style>{`
        @keyframes menuPopIn {
          from { opacity: 0; transform: scale(0.80) translateY(4px); }
          to   { opacity: 1; transform: scale(1.00) translateY(0);   }
        }
        @keyframes bubbleSpawn {
          0%   { transform: scale(0);   opacity: 0.6; }
          70%  { transform: scale(1.2); opacity: 1;   }
          100% { transform: scale(1.0); opacity: 1;   }
        }
        @keyframes bubbleFade {
          from { opacity: 1; scale: 1;   }
          to   { opacity: 0; scale: 0.8; }
        }
        @keyframes bubblePop {
          0%   { scale: 1;   opacity: 1;    }
          35%  { scale: 1.3; opacity: 0.85; }
          100% { scale: 0;   opacity: 0;    }
        }
        @keyframes emojiFloat {
          0%   { transform: translateY(0)      scale(1);   opacity: 1;   }
          60%  { transform: translateY(-60px)  scale(1.2); opacity: 0.9; }
          100% { transform: translateY(-120px) scale(0.8); opacity: 0;   }
        }
        @keyframes pururu {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25%      { transform: translate(-2px, 1px) scale(1.02); }
          75%      { transform: translate(2px, -1px) scale(0.98); }
        }
        @keyframes popParticle {
          0%   { opacity: 1;   transform: translate(0, 0) scale(1.2); }
          60%  { opacity: 0.6; }
          100% { opacity: 0;   transform: translate(var(--pdx), var(--pdy)) scale(0); }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: var(--star-op, 0.8); transform: scale(1); }
          40%      { opacity: 0.04; transform: scale(0.4); }
          70%      { opacity: var(--star-op, 0.8); transform: scale(1.1); }
        }
        input::placeholder { color: var(--placeholder-color, rgba(255,255,255,0.28)); }
        button:active { transform: scale(0.93); }
      `}</style>

      {/* インスタライブ型リアクションエフェクト（bubble/page.tsx と同一） */}
      <ReactionFloatingEffect
        isActive={true}
        onBurst={(x, y) => triggerPopBurst(x, y)}
        triggerCount={postCount}
      />
    </div>
  );
}

// ── ルートコンポーネント ────────────────────────────────────────────────

const MEME_KEY = 'sync_meme_image';

function BubbleV2PageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSettings = searchParams.get('from') === 'settings';
  const { user, profile, loading } = useAuth();
  const [step,      setStep]      = useState<'create' | 'bubble' | null>(null);
  const [memeImage, setMemeImage] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('sync_meme_image') || '' : ''
  );
  const [myBubbleColor, setMyBubbleColor] = useState(() => {
    if (typeof window === 'undefined') return 'rainbow';
    try {
      const style = localStorage.getItem('bubble_style');
      if (style) {
        const parsed = JSON.parse(style);
        if (parsed.borderColor === 'rainbow') return 'rainbow';
        if (parsed.borderColor && parsed.borderColor !== 'none') return parsed.borderColor;
      }
    } catch {}
    return 'rainbow';
  });
  const [bubbleTextColor, setBubbleTextColor] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('sync_bubble_text_color') || '#ffffff' : '#ffffff'
  );

  // localStorageの変更を検知して反映
  useEffect(() => {
    const handleStorage = () => {
      setMemeImage(localStorage.getItem('sync_meme_image') || '');
    };
    const syncColor = () => {
      try {
        const style = localStorage.getItem('bubble_style');
        if (style) {
          const parsed = JSON.parse(style);
          if (parsed.borderColor === 'rainbow') {
            setMyBubbleColor('rainbow');
          } else if (parsed.borderColor && parsed.borderColor !== 'none') {
            setMyBubbleColor(parsed.borderColor);
          } else {
            setMyBubbleColor('rgba(255,255,255,0.65)');
          }
        }
      } catch {}
      setBubbleTextColor(localStorage.getItem('sync_bubble_text_color') || '#ffffff');
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('storage', syncColor);
    window.addEventListener('sync_bubble_color_changed', syncColor);
    window.addEventListener('focus', syncColor);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('storage', syncColor);
      window.removeEventListener('sync_bubble_color_changed', syncColor);
      window.removeEventListener('focus', syncColor);
    };
  }, []);

  // 未ログイン時は /auth にリダイレクト
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    // ユーザー確認後に localStorage を確認して step を初期化
    const saved = localStorage.getItem(MEME_KEY);
    if (saved) {
      setMemeImage(saved);
      setStep('bubble');
    } else {
      setStep('create');
    }
  }, [loading, user, router]);

  function handleConfirm(url: string) {
    localStorage.setItem(MEME_KEY, url);
    setMemeImage(url);
    setStep('bubble');
  }

  function handleChangeMeme() {
    localStorage.removeItem(MEME_KEY);
    setStep('create');
  }

  if (loading || !user || !step) return <div style={{ height: '100dvh', background: '#0a0a1a' }} />;

  return (
    <div data-bubble-container style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390, zIndex: 10 }}>
      <AnimatePresence mode="wait">
        {step === 'create' ? (
          <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3 }} style={{ height: '100dvh' }}>
            <CreateScreen onConfirm={handleConfirm} onBack={() => fromSettings ? router.push('/settings') : setStep('bubble')} />
          </motion.div>
        ) : (
          <motion.div key="bubble" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} style={{ height: '100dvh' }}>
            <BubbleScreen selfImage={memeImage} onChangeMeme={handleChangeMeme} user={user} profile={profile} myBubbleColor={myBubbleColor} bubbleTextColor={bubbleTextColor} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BubbleV2Page() {
  return (
    <Suspense fallback={<div style={{ height: '100dvh', background: '#0a0a1a' }} />}>
      <BubbleV2PageInner />
    </Suspense>
  );
}
