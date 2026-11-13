import {
  GRASP_GLYPH,
  GRASP_LABEL,
  GRASP_ORDER,
  type Grasp,
} from "@/app/lib/daily/highlights";
import type { PendingSelection } from "./selection";

/** Over a fresh selection: pick how well it landed. */
export default function SelectionPopover({
  selection,
  saving,
  onPick,
}: {
  selection: PendingSelection;
  saving: boolean;
  onPick: (grasp: Grasp) => void;
}) {
  return (
    <div
      data-popover
      className="border-line bg-surface absolute z-20 w-60 rounded-sm border p-2 shadow-lg"
      style={{ top: selection.top, left: selection.left }}
    >
      <div className="flex gap-1">
        {GRASP_ORDER.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onPick(g)}
            disabled={saving}
            className={`hl hl-${g} font-pixel flex-1 rounded-sm px-2 py-1.5 text-[11px]`}
          >
            {GRASP_GLYPH[g]} {GRASP_LABEL[g]}
          </button>
        ))}
      </div>
      {selection.clipped && (
        <p className="text-ink-soft mt-2 font-mono text-[10px]">
          clipped to the end of this paragraph
        </p>
      )}
    </div>
  );
}
