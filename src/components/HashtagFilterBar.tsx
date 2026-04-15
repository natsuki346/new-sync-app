'use client';

import { RAINBOW } from '@/lib/rainbow';

interface HashtagFilterBarProps {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export default function HashtagFilterBar({
  tags,
  selected,
  onChange,
}: HashtagFilterBarProps) {
  const isAll = selected.length === 0;

  function toggle(tag: string) {
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag],
    );
  }

  return (
    <div
      className="flex overflow-x-auto"
      style={{
        borderBottom: '1px solid var(--surface-2)',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        flexWrap: 'nowrap',
      }}
    >
      {/* All チップ */}
      <button
        onClick={() => onChange([])}
        className="flex-shrink-0 text-xs font-semibold px-3 rounded-full transition-all duration-150"
        style={
          isAll
            ? {
                background: RAINBOW,
                color: '#ffffff',
                border: 'none',
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }
            : {
                background: 'transparent',
                color: 'var(--muted)',
                border: '1px solid var(--surface-2)',
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }
        }
      >
        All
      </button>

      {/* ハッシュタグチップ */}
      {tags.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => toggle(tag)}
            className="flex-shrink-0 text-xs font-semibold px-3 rounded-full transition-all duration-150"
            style={
              active
                ? {
                    background: RAINBOW,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    border: '1px solid #7C6FE8',
                    height: 28,
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--muted)',
                    border: '1px solid var(--surface-2)',
                    height: 28,
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }
            }
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
