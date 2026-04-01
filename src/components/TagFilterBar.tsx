"use client";

import { useState, useEffect } from "react";
import { RAINBOW } from "@/lib/rainbow";
import { createPortal } from "react-dom";
import { MY_PASSION } from "@/components/PassionGraph";

// HEATスコア上位5タグ
export const HEAT_TOP_TAGS: string[] = MY_PASSION.slice(0, 5).map((i) => i.tag);

// ── 型定義 ──────────────────────────────────────────────────────

interface PrefixItem {
  key:     string;
  label:   string;
  active:  boolean;
  onClick: () => void;
}

interface LeadingItem {
  label:   string;
  active:  boolean;
  onClick: () => void;
}

interface TagFilterBarProps {
  allTags:      string[];
  selectedTags: string[];
  onChange:     (tags: string[]) => void;
  variant?:     "red" | "light";
  prefixItems?: PrefixItem[];
  leadingItem?: LeadingItem;
  hideAllChip?: boolean;
}

// ── フルスクリーンモーダル ───────────────────────────────────────

function TagSelectModal({
  allTags,
  heatTags,
  initialSelected,
  onConfirm,
  onCancel,
}: {
  allTags:         string[];
  heatTags:        string[];
  initialSelected: string[];
  onConfirm:       (tags: string[]) => void;
  onCancel:        () => void;
}) {
  const [draft, setDraft] = useState<string[]>(initialSelected);
  const [root,  setRoot]  = useState<Element | null>(null);

  useEffect(() => {
    setRoot(document.getElementById("app-root"));
  }, []);

  function toggleDraft(tag: string) {
    setDraft((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  if (!root) return null;

  return createPortal(
    <div
      style={{
        position: "absolute", inset: 0, zIndex: 300,
        background: "rgb(var(--bg-rgb, 13 13 26))",
        display: "flex", flexDirection: "column",
        animation: "tagModalSlideDown 0.26s cubic-bezier(0.32,0.72,0,1)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── ヘッダー ── */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px 14px",
        borderBottom: "1px solid rgb(var(--border-rgb, 50 50 80))",
      }}>
        <button
          onClick={onCancel}
          style={{
            fontSize: 14, fontWeight: 500, padding: 0,
            color: "rgb(var(--muted-rgb, 136 136 170))",
            background: "none", border: "none", cursor: "pointer",
            minWidth: 64,
          }}
        >
          Cancel
        </button>
        <p style={{
          fontSize: 14, fontWeight: 700,
          color: "rgb(var(--fore-rgb, 255 255 255))", margin: 0,
        }}>
          Select Hashtags
        </p>
        <button
          onClick={() => setDraft([])}
          style={{
            fontSize: 12, fontWeight: 600, padding: 0,
            color: "#E63946", background: "none",
            border: "none", cursor: "pointer",
            minWidth: 64, textAlign: "right",
          }}
        >
          Clear All
        </button>
      </div>

      {/* ── タグ一覧（3列グリッド） ── */}
      <div style={{ flex: 1, overflow: "hidden", padding: "16px 16px 100px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}>
          {allTags.map((tag) => {
            const sel    = draft.includes(tag);
            const isHeat = heatTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleDraft(tag)}
                style={{
                  padding: "10px 4px",
                  borderRadius: 12,
                  fontSize: 12, fontWeight: 600,
                  textAlign: "center",
                  border:      sel ? "1.5px solid #7C6FE8" : "1px solid rgb(var(--border-rgb, 50 50 80))",
                  background:  sel ? "rgba(124,111,232,0.12)" : "transparent",
                  color:       sel ? "#7C6FE8" : "rgb(var(--muted-rgb, 136 136 170))",
                  cursor: "pointer", transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {isHeat && (
                  <span style={{ position: "absolute", top: 3, right: 6, fontSize: 9, lineHeight: 1 }}>🔥</span>
                )}
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 決定ボタン ── */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 390,
        padding: "12px 16px",
        paddingBottom: "max(env(safe-area-inset-bottom, 16px), 20px)",
        background: "rgb(var(--bg-rgb, 13 13 26))",
        borderTop: "1px solid rgb(var(--border-rgb, 50 50 80))",
        zIndex: 301,
      }}>
        <button
          onClick={() => onConfirm(draft)}
          style={{
            width: "100%", padding: "14px",
            borderRadius: 14, fontWeight: 700, fontSize: 15,
            color: "#fff", border: "none", cursor: "pointer",
            background: RAINBOW,
            boxShadow: "0 4px 16px rgba(124,111,232,0.35)",
          }}
        >
          {draft.length === 0 ? "Done" : `Done (${draft.length} selected)`}
        </button>
      </div>

      <style>{`
        @keyframes tagModalSlideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    root,
  );
}

// ── フィルターバー ───────────────────────────────────────────────

export function TagFilterBar({
  allTags,
  selectedTags,
  onChange,
  variant = "red",
  prefixItems,
  leadingItem,
  hideAllChip = false,
}: TagFilterBarProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const heatInAll     = HEAT_TOP_TAGS.filter((t) => allTags.includes(t));
  const extraSelected = selectedTags.filter((t) => !heatInAll.includes(t));
  const barTags       = [...heatInAll, ...extraSelected];

  const isAll = selectedTags.length === 0;

  const activeStyle: React.CSSProperties   = { background: RAINBOW, color: "#fff", border: "none" };
  const inactiveStyle: React.CSSProperties = variant === "red"
    ? { background: "rgba(230,57,70,0.06)", color: "#E63946", border: "1px solid rgba(230,57,70,0.2)" }
    : { background: "transparent", color: "rgb(var(--muted-rgb, 136 136 170))", border: "1px solid rgb(var(--border-rgb, 50 50 80))" };

  const chipBase: React.CSSProperties = {
    flexShrink: 0,
    fontSize:   variant === "red" ? 11 : 12,
    fontWeight: 600,
    borderRadius: 9999,
    padding:    variant === "red" ? "4px 12px" : "6px 14px",
    cursor:     "pointer",
    border:     "none",
  };

  function toggleTag(tag: string) {
    onChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag],
    );
  }

  return (
    <>
      {/* ── バー ── */}
      <div
        className="scrollbar-none"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "10px 16px",
          overflowX: "auto",
          borderTop: "1px solid rgba(var(--border-rgb, 50 50 80),0.5)",
        }}
      >
        {/* leadingItem（フォロー中など） + 縦線区切り */}
        {leadingItem && (
          <>
            <button
              onClick={leadingItem.onClick}
              style={leadingItem.active ? {
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 9999,
                padding: "5px 14px",
                cursor: "pointer",
                border: "none",
                background: RAINBOW,
                color: "#ffffff",
              } : {
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 9999,
                padding: "5px 14px",
                cursor: "pointer",
                background: "transparent",
                color: "var(--muted)",
                border: "1px solid var(--muted)",
              }}
            >
              {leadingItem.label}
            </button>
            {/* 縦線 */}
            <div style={{
              flexShrink: 0, width: 1, height: 16,
              background: "rgb(var(--border-rgb, 50 50 80))",
              borderRadius: 1, margin: "0 2px",
            }} />
          </>
        )}

        {/* すべて */}
        {!hideAllChip && (
          <button style={{ ...chipBase, ...(isAll ? activeStyle : inactiveStyle) }} onClick={() => onChange([])}>
            All
          </button>
        )}

        {prefixItems?.map((item) => (
          <button
            key={item.key}
            style={{ ...chipBase, ...(item.active ? activeStyle : inactiveStyle) }}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}

        {barTags.map((tag) => (
          <button
            key={tag}
            style={{ ...chipBase, ...(selectedTags.includes(tag) ? activeStyle : inactiveStyle) }}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}

        {/* All タグモーダル */}
        <button style={{ ...chipBase, ...inactiveStyle }} onClick={() => setModalOpen(true)}>
          All
        </button>
      </div>

      {/* ── フルスクリーンモーダル ── */}
      {modalOpen && (
        <TagSelectModal
          allTags={allTags}
          heatTags={heatInAll}
          initialSelected={selectedTags}
          onConfirm={(tags) => { onChange(tags); setModalOpen(false); }}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
