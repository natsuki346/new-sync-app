'use client';

import { useState, useRef } from 'react';

const REACTION_DEFAULTS = ['❤️', '👍', '👏', '😂', '😭'];
const REACTION_ALL = [
  '❤️','👍','👏','😂','😭','🔥','😍','🥹','😊','🤩',
  '😎','🥰','😆','🤣','😱','😢','😤','🫀','💫','⚡',
  '✨','💥','🙏','💪','🤝','👀','🫶','💯','🎉','🎊',
  '🌊','💎','👑','🚀','🌸','🍀','⭐','🌙','☀️','🌈',
  '🎵','🎶','🎸','🏆','🥇','💌','📣','🔔','💬','🫧',
];

interface FloatEmoji { id: number; emoji: string; x: number; delay: number }

export interface ReactionPickerProps {
  /** hashtag_engagements に紐づくタグ（コンテキスト情報） */
  hashtagId:      string;
  /** reactions テーブルに紐づく投稿ID（省略可） */
  postId?:        string;
  /** リアクション確定時のコールバック */
  onReact:        (emoji: string) => void;
  initialEmoji?:  string | null;
  reactionCount?: number;
}

export default function ReactionPicker({
  onReact,
  initialEmoji,
  reactionCount,
}: ReactionPickerProps) {
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(initialEmoji ?? null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [expandAll,    setExpandAll]    = useState(false);
  const [floatEmojis,  setFloatEmojis]  = useState<FloatEmoji[]>([]);
  const floatId = useRef(0);

  function handleReact(emoji: string) {
    setReactedEmoji(emoji);
    setShowPicker(false);
    setExpandAll(false);
    const newEmojis: FloatEmoji[] = Array.from({ length: 4 }, (_, i) => ({
      id:    floatId.current++,
      emoji,
      x:     (Math.random() - 0.5) * 80,
      delay: i * 85,
    }));
    setFloatEmojis((prev) => [...prev, ...newEmojis]);
    const ids = new Set(newEmojis.map((e) => e.id));
    setTimeout(() => setFloatEmojis((prev) => prev.filter((e) => !ids.has(e.id))), 1200);
    onReact(emoji);
  }

  return (
    <div className="relative">
      {/* トリガーボタン + カウント */}
      <div className="flex items-center gap-1">
        <button
          className="transition-all active:scale-90"
          style={{
            color:    reactedEmoji ? 'var(--brand)' : 'var(--muted)',
            fontSize: reactedEmoji ? 16 : undefined,
          }}
          onClick={() => { setShowPicker((v) => !v); setExpandAll(false); }}
        >
          {reactedEmoji ?? (
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round"
                d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
              />
            </svg>
          )}
        </button>
      </div>

      {/* 絵文字浮き上がりアニメーション */}
      {floatEmojis.map((fe) => (
        <div
          key={fe.id}
          className="absolute pointer-events-none select-none"
          style={{
            bottom:    16,
            left:      `calc(50% + ${fe.x}px)`,
            fontSize:  22,
            lineHeight: 1,
            animation: `emojiFlyAnim 0.9s ${fe.delay}ms ease-out forwards`,
          }}
        >
          {fe.emoji}
        </div>
      ))}

      {/* インライン絵文字ピッカー */}
      {showPicker && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {REACTION_DEFAULTS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="flex-1 flex items-center justify-center py-2 rounded-xl text-lg active:scale-90 transition-transform"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setExpandAll((v) => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold active:scale-90 transition-transform flex-shrink-0"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)', color: 'var(--muted)' }}
            >
              •••
            </button>
          </div>
          {expandAll && (
            <div
              className="flex flex-wrap gap-1 mt-1.5 max-h-36 overflow-y-auto p-2 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
            >
              {REACTION_ALL.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-lg rounded-lg active:scale-90 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
