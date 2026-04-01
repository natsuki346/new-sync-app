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
      className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto"
      style={{
        borderBottom: '1px solid var(--surface-2)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {/* All チップ */}
      <button
        onClick={() => onChange([])}
        className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full transition-all duration-150"
        style={
          isAll
            ? {
                background: RAINBOW,
                color: '#ffffff',
                border: 'none',
              }
            : {
                background: 'transparent',
                color: 'var(--muted)',
                border: '1px solid var(--surface-2)',
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
            className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full transition-all duration-150"
            style={
              active
                ? {
                    background: RAINBOW,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    border: '1px solid #7C6FE8',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--muted)',
                    border: '1px solid var(--surface-2)',
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
