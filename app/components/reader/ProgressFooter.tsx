"use client";

import type { ReadingProgress } from "./renditionLocation";

export default function ProgressFooter({
  progress,
  onGoToPage,
}: {
  progress: ReadingProgress;
  onGoToPage: (page: number) => void;
}) {
  return (
    <footer className="border-line flex items-center gap-3 border-t px-4 py-2">
      <input
        type="range"
        min={1}
        max={progress.total}
        value={progress.page}
        onChange={(e) => onGoToPage(Number(e.target.value))}
        aria-label="Jump to page"
        className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
      />
      <span className="text-ink-soft text-xs whitespace-nowrap">
        page {progress.page} of {progress.total}
      </span>
    </footer>
  );
}
