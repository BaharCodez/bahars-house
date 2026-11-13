"use client";

import type { TocEntry } from "./toc";

interface ChaptersDrawerProps {
  open: boolean;
  toc: TocEntry[];
  onSelect: (href: string) => void;
  onClose: () => void;
}

// Left side on desktop, sheet on mobile. It's fixed to the viewport, so it has
// to clear the house nav itself: that nav is a fixed 14rem column from `md` up
// (and a fixed 3.5rem bar below it), both of which sit above this drawer and
// would otherwise cover it.
export default function ChaptersDrawer({
  open,
  toc,
  onSelect,
  onClose,
}: ChaptersDrawerProps) {
  return (
    <aside
      className={`${open ? "flex" : "hidden"} border-line bg-surface fixed top-14 bottom-0 left-0 z-40 w-72 max-w-[80%] flex-col border-r shadow-2xl md:top-0 md:left-56`}
    >
      <div className="border-line flex items-center justify-between border-b px-4 py-3">
        <span className="font-serif text-sm font-medium">Chapters</span>
        <button onClick={onClose} className="text-ink hover:text-accent text-sm">
          ✕
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-2">
        {toc.map((chapter, i) => (
          <li key={i}>
            <button
              onClick={() => onSelect(chapter.href)}
              className="hover:bg-bg text-ink-soft hover:text-ink block w-full truncate px-4 py-2 text-left text-sm"
              style={{ paddingLeft: `${1 + chapter.depth * 0.75}rem` }}
            >
              {chapter.label || "Untitled"}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
