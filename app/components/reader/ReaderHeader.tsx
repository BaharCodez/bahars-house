"use client";

import { useState } from "react";
import AmbientMusic from "../AmbientMusic";
import type { ReadingMode } from "./useBookRendition";

const PILL_BUTTON =
  "border-line text-ink-soft hover:bg-surface shrink-0 rounded-full border px-3 py-1 text-sm";
const FONT_STEP = 10;
const COPIED_NOTICE_MS = 2000;

interface ReaderHeaderProps {
  title: string;
  hasChapters: boolean;
  mode: ReadingMode;
  noteCount: number;
  onClose: () => void;
  onToggleChapters: () => void;
  onChangeFontScale: (delta: number) => void;
  onToggleMode: () => void;
  onToggleNotes: () => void;
}

export default function ReaderHeader({
  title,
  hasChapters,
  mode,
  noteCount,
  onClose,
  onToggleChapters,
  onChangeFontScale,
  onToggleMode,
  onToggleNotes,
}: ReaderHeaderProps) {
  return (
    <header className="border-line touch-scroll flex items-center gap-2 overflow-x-auto border-b px-3 py-3">
      <button
        onClick={onClose}
        className="text-ink-soft hover:text-ink shrink-0 text-sm"
      >
        ←<span className="hidden sm:inline"> Bookshelf</span>
      </button>
      {hasChapters && (
        <button
          onClick={onToggleChapters}
          aria-label="Chapters"
          title="Chapters"
          className={PILL_BUTTON}
        >
          📑<span className="hidden sm:inline"> Chapters</span>
        </button>
      )}
      <h1 className="text-ink max-w-[38vw] shrink-0 truncate px-1 font-serif text-base font-medium">
        {title}
      </h1>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="border-line text-ink-soft flex items-center rounded-full border">
          <button
            onClick={() => onChangeFontScale(-FONT_STEP)}
            aria-label="Smaller text"
            title="Smaller text"
            className="hover:text-ink px-2 py-1 text-xs"
          >
            A−
          </button>
          <button
            onClick={() => onChangeFontScale(FONT_STEP)}
            aria-label="Larger text"
            title="Larger text"
            className="hover:text-ink px-2 py-1 text-base"
          >
            A+
          </button>
        </div>
        <button
          onClick={onToggleMode}
          title={
            mode === "paginated"
              ? "Switch to scroll mode (beta — may jump at chapters)"
              : "Switch to page mode"
          }
          className={PILL_BUTTON}
        >
          {mode === "paginated" ? "📖 Pages" : "📜 Scroll · beta"}
        </button>
        <AmbientMusic />
        <ShareButton />
        <button
          onClick={onToggleNotes}
          aria-label="Notes"
          className={PILL_BUTTON}
        >
          🗒 {noteCount}
        </button>
      </div>
    </header>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_NOTICE_MS);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <button
      onClick={copyLink}
      className="border-line text-ink-soft hover:bg-surface rounded-full border px-3 py-1 text-sm"
    >
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
