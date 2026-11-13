import { useState } from "react";
import Link from "next/link";
import type { Grasp } from "@/app/lib/daily/highlights";
import type { Bookmark } from "./types";

export default function BookmarkRow({
  bookmark,
  tally,
  canEdit,
  shelfNames,
  moving,
  onToggleMoving,
  onMove,
  onToggleFavorite,
  onRemove,
}: {
  bookmark: Bookmark;
  tally: Record<Grasp, number> | undefined;
  canEdit: boolean;
  shelfNames: string[];
  moving: boolean;
  onToggleMoving: () => void;
  onMove: (shelf: string) => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
}) {
  const b = bookmark;
  return (
    <li className="border-line flex items-start gap-2 border-b py-2 last:border-0">
      <button
        type="button"
        onClick={onToggleFavorite}
        title={b.favorite ? "in the pile" : "add to the pile"}
        className="text-accent shrink-0 pt-0.5 text-sm"
      >
        {b.favorite ? "★" : "☆"}
      </button>
      <div className="min-w-0 flex-1">
        {b.source && (
          <p className="text-accent-2 font-mono text-[10px] font-bold">
            {b.source}
          </p>
        )}
        <a
          href={b.url}
          target="_blank"
          rel="noreferrer"
          className="text-ink hover:text-accent block truncate text-sm underline-offset-4 hover:underline"
        >
          {b.title} ↗
        </a>
        {/* the desk is hers alone — it caches the article to mark up */}
        {canEdit && (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Link
              href={`/daily/read/${b.id}`}
              className="text-accent font-mono text-[11px] hover:underline"
            >
              {b.pulledIn ? "read here →" : "read it here →"}
            </Link>
            {tally && <GraspTally tally={tally} />}
            <button
              type="button"
              onClick={onToggleMoving}
              className="text-ink-soft hover:text-ink font-mono text-[11px]"
            >
              {moving ? "cancel" : "move →"}
            </button>
          </div>
        )}
        {canEdit && moving && (
          <ShelfPicker
            current={b.shelf}
            shelfNames={shelfNames}
            onPick={onMove}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        title="remove from the shelf"
        className="text-ink hover:text-accent shrink-0 text-sm"
      >
        ×
      </button>
    </li>
  );
}

function GraspTally({ tally }: { tally: Record<Grasp, number> }) {
  return (
    <span className="text-ink-soft font-mono text-[11px]">
      <span className="hl hl-got px-1">{tally.got}</span>{" "}
      <span className="hl hl-half px-1">{tally.half}</span>{" "}
      <span className="hl hl-lost px-1">{tally.lost}</span>
    </span>
  );
}

/** Pick an existing shelf, or name a new one. */
function ShelfPicker({
  current,
  shelfNames,
  onPick,
}: {
  current: string;
  shelfNames: string[];
  onPick: (shelf: string) => void;
}) {
  const [newShelf, setNewShelf] = useState("");
  return (
    <div className="border-line bg-bg-2/40 fade-up mt-2 rounded-sm border p-2">
      <div className="flex flex-wrap gap-1">
        {shelfNames
          .filter((name) => name !== current)
          .map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onPick(name)}
              className="border-line text-ink hover:border-accent hover:text-accent rounded-full border px-2.5 py-1 font-mono text-[11px]"
            >
              {name}
            </button>
          ))}
        {current && (
          <button
            type="button"
            onClick={() => onPick("")}
            className="text-ink-soft hover:text-ink rounded-full px-2.5 py-1 font-mono text-[11px]"
          >
            off this shelf
          </button>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = newShelf.trim();
          if (name) onPick(name);
        }}
        className="mt-2 flex gap-2"
      >
        <input
          type="text"
          value={newShelf}
          onChange={(e) => setNewShelf(e.target.value)}
          maxLength={40}
          placeholder="or a new shelf…"
          className="border-line text-ink focus:border-accent min-w-0 flex-1 rounded-sm border bg-transparent px-2 py-1 text-xs outline-none"
        />
        <button
          type="submit"
          disabled={!newShelf.trim()}
          className="text-accent font-mono text-[11px] hover:underline disabled:opacity-40"
        >
          shelve it
        </button>
      </form>
    </div>
  );
}
