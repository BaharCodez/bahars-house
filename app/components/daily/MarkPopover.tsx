import {
  GRASP_GLYPH,
  GRASP_LABEL,
  GRASP_ORDER,
  type Grasp,
  type Highlight,
} from "@/app/lib/daily/highlights";
import type { PopoverPosition } from "./selection";

/** Over an existing mark: re-grade it, write why, or drop it. */
export default function MarkPopover({
  mark,
  at,
  draftNote,
  onDraftNote,
  onRegrade,
  onSaveNote,
  onRemove,
  onDone,
}: {
  mark: Highlight;
  at: PopoverPosition;
  draftNote: string;
  onDraftNote: (note: string) => void;
  onRegrade: (grasp: Grasp) => void;
  onSaveNote: (note: string) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  function saveNoteIfChanged() {
    if (draftNote !== mark.note) onSaveNote(draftNote);
  }

  return (
    <div
      data-popover
      className="border-line bg-surface absolute z-20 w-64 rounded-sm border p-2 shadow-lg"
      style={{ top: at.top, left: at.left }}
    >
      <div className="flex gap-1">
        {GRASP_ORDER.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onRegrade(g)}
            className={`font-pixel flex-1 rounded-sm px-2 py-1.5 text-[11px] ${
              mark.grasp === g
                ? `hl hl-${g} ring-accent ring-1`
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {GRASP_GLYPH[g]} {GRASP_LABEL[g]}
          </button>
        ))}
      </div>
      <textarea
        value={draftNote}
        onChange={(e) => onDraftNote(e.target.value)}
        onBlur={saveNoteIfChanged}
        rows={2}
        placeholder={
          mark.grasp === "got"
            ? "say it back in your own words…"
            : "what's missing? (optional)"
        }
        className="border-line text-ink focus:border-accent mt-2 w-full resize-none rounded-sm border bg-transparent px-2 py-1 text-xs outline-none"
      />
      <div className="mt-1 flex justify-between">
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-soft hover:text-ink font-mono text-[11px]"
        >
          remove
        </button>
        <button
          type="button"
          onClick={() => {
            saveNoteIfChanged();
            onDone();
          }}
          className="text-accent font-mono text-[11px] hover:underline"
        >
          done
        </button>
      </div>
    </div>
  );
}
