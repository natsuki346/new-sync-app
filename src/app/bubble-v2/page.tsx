'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SyncLogo from '@/components/SyncLogo';
import ReactionFloatingEffect from '@/components/ReactionFloatingEffect';

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

// ── 住人データ ───────────────────────────────────────────────────────────

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

// ── タップモーダル関連（bubble/page.tsx BubbleActionMenu と同一デザイン） ──

const REACT_EMOJIS = ['❤️', '😂', '😮', '😢', '👏'] as const;
const ACTION_MENU_W = 264;

interface TapMenu {
  personId:    number;
  personEmoji: string;
  text:        string;
  clientX:     number;
  clientY:     number;
}

function TapModal({ menu, onClose }: {
  menu:    TapMenu;
  onClose: () => void;
}) {
  const [flyEmoji, setFlyEmoji] = useState<{ emoji: string; x: number; y: number } | null>(null);

  function handleReact(emoji: string, e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setFlyEmoji({ emoji, x: r.left + r.width / 2, y: r.top });
    setTimeout(onClose, 650);
  }

  const vw     = typeof window !== 'undefined' ? window.innerWidth  : 390;
  const vh     = typeof window !== 'undefined' ? window.innerHeight : 844;
  const MARGIN = 10;
  const CARD_H = 216;
  let left = menu.clientX - ACTION_MENU_W / 2;
  let top  = menu.clientY + 14;
  if (top + CARD_H > vh - 20) top = menu.clientY - CARD_H - 14;
  if (top < 56) top = 56;
  left = Math.max(MARGIN, Math.min(left, vw - ACTION_MENU_W - MARGIN));

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
        }}
        onClick={e => e.stopPropagation()}
      >
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

        {/* リアクション行（常に表示） */}
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
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 12, marginBottom: 8, background: 'rgba(17,138,178,0.10)', border: '1px solid rgba(17,138,178,0.22)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxSizing: 'border-box' }}
        >
          <span style={{ fontSize: 15 }}>✉️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#118AB2' }}>DMを送る</span>
        </button>

        {/* プロフィールを見る */}
        <button
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxSizing: 'border-box' }}
        >
          <span style={{ fontSize: 15 }}>👤</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>プロフィールを見る</span>
        </button>
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
            background:           'rgba(255,255,255,0.08)',
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
}

function PersonCircle({ emoji, size, opacity, floatDuration, floatDelay, messages, x, y, borderColor, onBubbleTap, onMemeTap, onPop }: PersonCircleProps) {
  const [activeBubble, setActiveBubble] = useState<string | null>(null);
  const [isNew,        setIsNew]        = useState(false);
  const [isDanger,     setIsDanger]     = useState(false);
  const [isLiked,      setIsLiked]      = useState(false);
  const [floatEmojis,  setFloatEmojis]  = useState<{ id: number; dx: number; sz: number; delay: number }[]>([]);

  const bubbleWrapperRef = useRef<HTMLDivElement>(null);
  const floatIdRef       = useRef(0);

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
        setActiveBubble(msg);
        setIsNew(true);
        isNewTimer = setTimeout(() => setIsNew(false), 400);
        dangerTimer = setTimeout(() => setIsDanger(true), PERSON_BUBBLE_SHOW_MS - DANGER_THRESHOLD * 1000);

        // 寿命後 bubblePop → pop burst → setActiveBubble(null)
        popTimer = setTimeout(() => {
          const el = bubbleWrapperRef.current;
          if (el) {
            el.style.animation    = 'bubblePop 0.3s ease-out forwards';
            el.style.pointerEvents = 'none';
            const r = el.getBoundingClientRect();
            onPop(r.left + r.width / 2, r.top + r.height / 2);
          }
          clearTimer = setTimeout(() => {
            setActiveBubble(null);
            setIsDanger(false);
            scheduleNext();
          }, 350);
        }, PERSON_BUBBLE_SHOW_MS);
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
      {/* 浮遊アニメーション（-15px ↕ mirror） */}
      <motion.div
        animate={{ y: -15 }}
        transition={{ duration: floatDuration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: floatDelay }}
        style={{ position: 'relative', width: size, height: size }}
      >
        {/* バブル（アクティブ時のみ）— ref で bubblePop を直接適用 */}
        {activeBubble && (
          <div ref={bubbleWrapperRef}>
            {/* 出現アニメーション + 危険時グロー */}
            <div style={{
              animation:  isNew ? 'bubbleSpawn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
              filter:     isDanger ? 'drop-shadow(0 0 8px rgba(255,255,255,0.9))' : 'none',
              transition: 'filter 0.3s ease',
            }}>
              <SpeechBubble
                text={activeBubble} emoji={emoji}
                borderColor={borderColor} isDanger={isDanger} isLiked={isLiked}
                onReact={handleReact}
                onBubbleTap={(cx, cy) => onBubbleTap(cx, cy, activeBubble)}
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
  text:    string;
  danger:  boolean;
  divRef:  React.RefObject<HTMLDivElement | null>;
  cx:      number;
  cy:      number;
  selfSize:number;
}

function SelfBubbleView({ text, danger, divRef, cx, cy, selfSize }: SelfBubbleViewProps) {
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
      {/* 出現アニメーション + 危険時グロー（bubble/page.tsx BubbleItem と同一） */}
      <div style={{
        animation:  isNew ? 'bubbleSpawn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
        filter:     danger ? 'drop-shadow(0 0 8px rgba(255,255,255,0.9))' : 'none',
        transition: 'filter 0.3s ease',
      }}>
        {/* バブル本体 */}
        <div style={{
          position:             'relative',
          display:              'flex',
          alignItems:           'center',
          gap:                  6,
          padding:              '5px 10px',
          background:           'rgba(255,255,255,0.08)',
          borderRadius:         20,
          border:               '1.5px solid #7C6FE8',
          boxShadow:            'inset 0 1px 2px rgba(255,255,255,0.15)',
          animation:            danger ? 'pururu 0.4s ease-in-out infinite' : 'none',
          backdropFilter:       'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          overflow:             'hidden',
          maxWidth:             160,
          whiteSpace:           'nowrap',
        }}>
          {/* 光沢ハイライト */}
          <div style={{ position: 'absolute', top: 3, left: 6, width: '25%', height: '50%', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)', pointerEvents: 'none' }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.01em' }}>
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── STEP 1: ミーム生成画面 ───────────────────────────────────────────────

function CreateScreen({ onConfirm }: { onConfirm: (url: string) => void }) {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

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
      else alert(data.error ?? '生成に失敗しました');
    } catch {
      alert('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  const CIRCLE     = 148;
  const displaySrc = generated ?? preview;
  const canGenerate = !!file && !loading && !generated;

  return (
    <div style={{ height: '100dvh', background: '#0a0a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', gap: 28, overflow: 'hidden' }}>
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

function BubbleScreen({ selfImage, onChangeMeme }: { selfImage: string; onChangeMeme: () => void }) {
  // 時間帯
  const [tod, setTod] = useState<ToD>(() => getToD(new Date().getHours()));

  // 星・大気（クライアントサイドのみ生成、bubble/page.tsx と同一）
  const MICRO  = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ id: i,     left: (Math.sin(i*7.391)*0.5+0.5)*100, top: (Math.sin(i*3.714+1.2)*0.5+0.5)*90, size: 0.5+(i%3)*0.18,  op: 0.10+(i%8)*0.05,  dur: 4+(i%7)*0.7,   delay: (i%17)*0.31 })), []);
  const NORMAL = useMemo(() => Array.from({ length: 50 }, (_, i) => ({ id: 100+i, left: (Math.sin(i*5.123+0.5)*0.5+0.5)*100, top: (Math.sin(i*2.841+2.8)*0.5+0.5)*88, size: 1+(i%4)*0.32,   op: 0.32+(i%6)*0.09, dur: 2.8+(i%9)*0.42, delay: (i%11)*0.42 })), []);
  const BRIGHT = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ id: 155+i, left: (Math.sin(i*9.432+1.8)*0.5+0.5)*100, top: (Math.sin(i*4.567+0.3)*0.5+0.5)*80, size: 1.9+(i%4)*0.38, op: 0.6+(i%4)*0.08,  dur: 2.2+(i%8)*0.35, delay: (i%13)*0.52 })), []);
  const NEBULA = useMemo(() => Array.from({ length: 6  }, (_, i) => ({ id: i, left: (Math.sin(i*4.123+0.7)*0.5+0.5)*100, top: (Math.sin(i*2.987+1.4)*0.5+0.5)*85, size: 90+(i%4)*62, color: ['rgba(70,30,160,0.055)','rgba(30,18,110,0.045)','rgba(90,50,190,0.06)','rgba(18,25,100,0.05)','rgba(50,18,130,0.045)','rgba(70,50,190,0.065)'][i] })), []);
  const CLOUDS = useMemo(() => Array.from({ length: 7  }, (_, i) => ({ id: i, left: (Math.sin(i*6.28+0.4)*0.5+0.5)*100, top: 20+(Math.sin(i*3.14+1.1)*0.5+0.5)*55, w: 100+(i%4)*55, h: 26+(i%3)*12 })), []);

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

  const blinkData = useRef(PEOPLE.map(() => makeFloatData()));

  // 時間帯（1分ごと更新）
  useEffect(() => {
    const id = setInterval(() => setTod(getToD(new Date().getHours())), 60_000);
    return () => clearInterval(id);
  }, []);

  // ResizeObserver
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const update = () => setFieldSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  // 自分ミームのアニメーション
  const selfFloatData = useRef(makeFloatData()).current;

  // タップモーダル
  const [tapMenu, setTapMenu] = useState<TapMenu | null>(null);

  function openModal(p: typeof PEOPLE[0], clientX: number, clientY: number, text: string) {
    setTapMenu({ personId: p.id, personEmoji: p.emoji, text, clientX, clientY });
  }

  // ReactionFloatingEffect 用（bubble/page.tsx と同一）
  const [postCount, setPostCount] = useState(0);

  // アンマウント時タイマークリーンアップ
  useEffect(() => {
    return () => {
      if (dangerTimerRef.current) clearTimeout(dangerTimerRef.current);
      if (popTimerRef.current)    clearTimeout(popTimerRef.current);
    };
  }, []);

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

  // 自分投稿後に他人からリアクションが飛んでくるモック演出
  function handleSend() {
    if (!inputText.trim()) return;
    const text     = inputText.trim();
    const bubbleId = makeId();
    setInputText('');

    if (dangerTimerRef.current) clearTimeout(dangerTimerRef.current);
    if (popTimerRef.current)    clearTimeout(popTimerRef.current);
    setSelfBubbleDanger(false);
    setSelfBubble({ id: bubbleId, text });

    // 残り DANGER_THRESHOLD 秒で危険演出
    dangerTimerRef.current = setTimeout(
      () => setSelfBubbleDanger(true),
      (BUBBLE_LIFETIME - DANGER_THRESHOLD) * 1000,
    );

    // ReactionFloatingEffect をトリガー（bubble/page.tsx の postCount と同一）
    setPostCount(n => n + 1);

    // BUBBLE_LIFETIME 秒後にパチン
    popTimerRef.current = setTimeout(() => {
      const el    = selfBubbleElRef.current;
      const field = fieldRef.current;
      if (el) {
        el.style.animation    = 'bubbleFade 0.3s ease-out forwards';
        el.style.pointerEvents = 'none';
        if (field) triggerPopBurst(field.offsetWidth / 2, field.offsetHeight / 2 - SELF_SIZE / 2);
      }
      setTimeout(() => {
        setSelfBubble(prev => prev?.id === bubbleId ? null : prev);
        setSelfBubbleDanger(false);
      }, 350);
    }, BUBBLE_LIFETIME * 1000);
  }

  const SELF_SIZE = 68;
  const ready     = w > 0 && h > 0;
  // 元の2リング配置（最初の実装と同じ）
  const cx = w / 2;
  const cy = h / 2;
  const r1 = Math.min(cx, cy) * 0.82;   // Ring1 隣接距離 ≈ 95px → ~116px
  const r2 = Math.min(cx, cy) * 1.35;   // Ring2 隣接距離 ≈ 67px → ~  84px（半径拡大で密度解消）
  const positions = [
    ...Array.from({ length: 10 }, (_, i) => { const a = (i/10)*Math.PI*2 - Math.PI/2; return { x: cx + r1*Math.cos(a), y: cy + r1*Math.sin(a), ring: 1 as const }; }),
    ...Array.from({ length: 19 }, (_, i) => { const a = (i/19)*Math.PI*2 - Math.PI/2; return { x: cx + r2*Math.cos(a), y: cy + r2*Math.sin(a), ring: 2 as const }; }),
  ];

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#0a0a1a' }}>

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', flexShrink: 0, zIndex: 10 }}>
        <SyncLogo width={100} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
            {ONLINE}
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
      <div ref={fieldRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0, zIndex: 10 }}>
        {ready && (
          <motion.div
            drag
            dragConstraints={{ top: -100, bottom: 100, left: -100, right: 100 }}
            dragElastic={0.05}
            dragMomentum={true}
            style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
          >
            {/* 29人（元の2リング配置） */}
            {PEOPLE.map((p, i) => {
              const pos         = positions[i];
              const size        = pos.ring === 1 ? 56 : 38;
              const opacity     = pos.ring === 1 ? 0.88 : 0.62;
              const bd          = blinkData.current[i];
              const borderColor = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
              return (
                <PersonCircle key={p.id} emoji={p.emoji}
                  size={size} opacity={opacity}
                  floatDuration={bd.floatDuration} floatDelay={bd.floatDelay}
                  messages={p.messages}
                  x={pos.x} y={pos.y}
                  borderColor={borderColor}
                  onBubbleTap={(cx, cy, text) => openModal(p, cx, cy, text)}
                  onMemeTap={(cx, cy) => openModal(p, cx, cy, p.messages[0])}
                  onPop={(bx, by) => triggerPopBurst(bx, by)}
                />
              );
            })}

            {/* 自分（中央） */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 20, delay: 0.1 }}
              style={{ position: 'absolute', left: cx - SELF_SIZE/2, top: cy - SELF_SIZE/2, width: SELF_SIZE, height: SELF_SIZE, zIndex: 3 }}
            >
              <motion.div
                animate={{ y: -15 }}
                transition={{ duration: selfFloatData.floatDuration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: selfFloatData.floatDelay + 0.6 }}
                style={{ position: 'relative', width: SELF_SIZE, height: SELF_SIZE, borderRadius: '50%', overflow: 'hidden', border: '2.5px solid rgba(255,255,255,0.65)', boxShadow: '0 0 24px rgba(124,111,232,0.6), 0 0 48px rgba(124,111,232,0.2)' }}
              >
                <img src={selfImage} alt="自分のミーム" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

      {/* ── 入力欄（送信ボタン付き） ── */}
      <div style={{ flexShrink: 0, padding: '10px 16px 16px', background: 'rgba(10,10,26,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '0.5px solid rgba(255,255,255,0.07)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 22, padding: '8px 12px 8px 14px', background: inputText.trim() ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(124,111,232,0.35)', boxShadow: inputText.trim() ? '0 0 12px rgba(124,111,232,0.3)' : 'none', transition: 'box-shadow 0.25s ease, background 0.25s ease' }}>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="今どうしてる？..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#fff' }}
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
        input::placeholder { color: rgba(255,255,255,0.28); }
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

export default function BubbleV2Page() {
  const [step,      setStep]      = useState<'create' | 'bubble' | null>(null);
  const [memeImage, setMemeImage] = useState<string>('');

  // 起動時に localStorage を確認
  useEffect(() => {
    const saved = localStorage.getItem(MEME_KEY);
    if (saved) {
      setMemeImage(saved);
      setStep('bubble');
    } else {
      setStep('create');
    }
  }, []);

  function handleConfirm(url: string) {
    localStorage.setItem(MEME_KEY, url);
    setMemeImage(url);
    setStep('bubble');
  }

  function handleChangeMeme() {
    localStorage.removeItem(MEME_KEY);
    setMemeImage('');
    setStep('create');
  }

  if (!step) return <div style={{ height: '100dvh', background: '#0a0a1a' }} />;

  return (
    <AnimatePresence mode="wait">
      {step === 'create' ? (
        <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3 }} style={{ height: '100dvh' }}>
          <CreateScreen onConfirm={handleConfirm} />
        </motion.div>
      ) : (
        <motion.div key="bubble" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} style={{ height: '100dvh' }}>
          <BubbleScreen selfImage={memeImage} onChangeMeme={handleChangeMeme} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
