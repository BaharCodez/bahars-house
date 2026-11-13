import { useMemo, useState } from "react";
import type { Grasp } from "@/app/lib/daily/highlights";
import { groupByShelf, shelfNamesOf } from "@/app/lib/daily/shelves";
import AddLinkForm from "./AddLinkForm";
import BookmarkRow from "./BookmarkRow";
import type { Bookmark } from "./types";
import type { ShelfState } from "./useShelf";

const SHELF_HEADING =
  "font-pixel text-ink-soft text-[11px] tracking-wider uppercase";

/** Articles worth keeping — a running dissertation pile. */
export default function Shelf({
  shelf,
  marks,
  canEdit,
}: {
  shelf: ShelfState;
  marks: Record<string, Record<Grasp, number>>;
  canEdit: boolean;
}) {
  // Which read is having its shelf changed (the inline "move to" row).
  const [movingId, setMovingId] = useState<string | null>(null);
  const { bookmarks } = shelf;

  const pile = bookmarks.filter((b) => b.favorite);
  const rest = bookmarks.filter((b) => !b.favorite);
  const shelves = groupByShelf(rest);
  const shelfNames = useMemo(() => shelfNamesOf(bookmarks), [bookmarks]);

  const row = (b: Bookmark) => (
    <BookmarkRow
      key={b.id}
      bookmark={b}
      tally={marks[b.id]}
      canEdit={canEdit}
      shelfNames={shelfNames}
      moving={movingId === b.id}
      onToggleMoving={() => setMovingId((m) => (m === b.id ? null : b.id))}
      onMove={(name) => {
        setMovingId(null);
        void shelf.moveToShelf(b, name);
      }}
      onToggleFavorite={() => void shelf.toggleFavorite(b)}
      onRemove={() => void shelf.remove(b)}
    />
  );

  return (
    <section className="pixel-frame bg-surface p-4 sm:p-5">
      <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
        the shelf
      </h2>
      <p className="text-ink-soft mt-1 text-xs">
        reads worth keeping. star the best into the pile, and use{" "}
        <span className="font-mono">move →</span> to sort the rest onto shelves
        of your own.
      </p>
      {shelf.note && (
        <p className="text-accent-2 mt-2 text-xs font-medium">{shelf.note}</p>
      )}

      <AddLinkForm onSave={shelf.save} />

      {pile.length > 0 && (
        <div className="mt-5">
          <h3 className="font-pixel text-accent text-[11px] tracking-wider uppercase">
            ★ the pile
          </h3>
          <ul className="mt-2">{pile.map(row)}</ul>
        </div>
      )}

      {rest.length > 0 ? (
        shelves.map(([name, reads]) => (
          <div key={name || "—"} className="mt-5">
            <h3 className={SHELF_HEADING}>
              {name || "on the shelf"}
              <span className="ml-2 font-mono normal-case">{reads.length}</span>
            </h3>
            <ul className="mt-2">{reads.map(row)}</ul>
          </div>
        ))
      ) : (
        <div className="mt-5">
          <h3 className={SHELF_HEADING}>on the shelf</h3>
          <p className="text-ink-soft mt-2 text-sm">
            {bookmarks.length === 0
              ? "Nothing shelved yet. Save a read above."
              : "Everything here is in the pile."}
          </p>
        </div>
      )}
    </section>
  );
}
