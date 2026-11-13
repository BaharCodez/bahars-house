import type { Highlight } from "@/app/lib/daily/highlights";
import MarkedQuote from "./MarkedQuote";

/** The point of the whole thing: what's still fuzzy in this read. */
export default function ReaderFuzzyNotes({
  highlights,
  orphans,
  pulling,
  pullError,
  onGotIt,
  onRemove,
  onPullAgain,
}: {
  highlights: Highlight[];
  orphans: Highlight[];
  pulling: boolean;
  pullError: string | null;
  onGotIt: (id: string) => void;
  onRemove: (id: string) => void;
  onPullAgain: () => void;
}) {
  const fuzzy = highlights.filter((h) => h.grasp !== "got");
  return (
    <section className="border-line bg-surface mt-10 rounded-sm border p-5">
      <h2 className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
        what I don&apos;t get yet
      </h2>
      {fuzzy.length === 0 ? (
        <p className="text-ink-soft mt-2 text-sm">
          {highlights.length === 0
            ? "Nothing marked up yet. Highlight as you read — the fuzzy bits collect here."
            : "Nothing fuzzy left in this one. 🎉"}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {fuzzy.map((h) => (
            <li key={h.id} className="border-line border-b pb-3 last:border-0">
              <MarkedQuote quote={h.quote} note={h.note} grasp={h.grasp} />
              <div className="mt-1 flex gap-3">
                <button
                  type="button"
                  onClick={() => onGotIt(h.id)}
                  title="it landed — turn it green"
                  className="text-ink-soft hover:text-ink font-mono text-[11px]"
                >
                  ✓ I get it now
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(h.id)}
                  title="drop the mark entirely"
                  className="text-ink-soft hover:text-ink font-mono text-[11px]"
                >
                  remove ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {orphans.length > 0 && (
        <div className="mt-5">
          <h3 className="text-ink-soft font-mono text-[11px] tracking-[0.2em] uppercase">
            marks whose text has moved
          </h3>
          <ul className="mt-2 space-y-2">
            {orphans.map((h) => (
              <li key={h.id} className="text-ink-soft text-sm">
                “{h.quote}”{" "}
                <button
                  type="button"
                  onClick={() => onRemove(h.id)}
                  className="hover:text-ink font-mono text-[11px]"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onPullAgain}
        disabled={pulling}
        className="text-ink-soft hover:text-ink mt-5 font-mono text-[11px]"
      >
        {pulling ? "…" : "pull the article in again"}
      </button>
      {pullError && <p className="text-accent-2 mt-2 text-xs">{pullError}</p>}
    </section>
  );
}
