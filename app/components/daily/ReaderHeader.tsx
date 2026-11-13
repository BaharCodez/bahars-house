import {
  GRASP_GLYPH,
  GRASP_LABEL,
  GRASP_ORDER,
  type Grasp,
} from "@/app/lib/daily/highlights";
import { dismissHint, useShowHint } from "./useReaderHint";
import type { ReaderBookmark } from "./types";

/** What this read is, and how it's landing so far. */
export default function ReaderHeader({
  bookmark,
  counts,
}: {
  bookmark: ReaderBookmark;
  counts: Record<Grasp, number>;
}) {
  const showHint = useShowHint();
  return (
    <div className="border-line bg-surface mb-6 rounded-sm border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
          {bookmark.source || new URL(bookmark.url).hostname}
        </span>
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          className="text-ink-soft hover:text-accent font-mono text-xs"
        >
          the original ↗
        </a>
      </div>
      <h1 className="text-ink mt-1 font-serif text-2xl leading-snug">
        {bookmark.title}
      </h1>
      {bookmark.byline && (
        <p className="text-ink-soft mt-1 text-sm">{bookmark.byline}</p>
      )}
      <div className="text-ink-soft mt-3 flex flex-wrap gap-4 font-mono text-xs">
        {GRASP_ORDER.map((g) => (
          <span key={g}>
            <span className={`hl hl-${g} px-1`}>{GRASP_GLYPH[g]}</span>{" "}
            {GRASP_LABEL[g]} {counts[g]}
          </span>
        ))}
      </div>
      {/* the how-to, until you know it — then it's gone for good */}
      {showHint && (
        <p className="text-ink-soft mt-2 flex items-baseline gap-2 text-xs">
          <span className="flex-1">
            Select any sentence to mark how well it landed.
          </span>
          <button
            type="button"
            onClick={dismissHint}
            title="got it — stop showing this"
            className="hover:text-ink shrink-0 font-mono"
          >
            ×
          </button>
        </p>
      )}
    </div>
  );
}
