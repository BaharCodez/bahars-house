import { useState } from "react";
import Link from "next/link";
import { GRASP_LABEL } from "@/app/lib/daily/highlights";
import MarkedQuote from "./MarkedQuote";
import type { FuzzyMark } from "./types";

/** Everything across the shelf that only half landed. */
export default function FuzzyPile({
  initialMarks,
  onRefused,
}: {
  initialMarks: FuzzyMark[];
  onRefused: (note: string) => void;
}) {
  const [marks, setMarks] = useState(initialMarks);

  // The "I get this now" ×. It deletes the highlight itself, so it goes from
  // the article too.
  async function forget(id: string) {
    const before = marks;
    setMarks((f) => f.filter((h) => h.id !== id));
    const res = await fetch(`/api/highlights/${id}`, { method: "DELETE" });
    if (res.ok) return;
    setMarks(before);
    onRefused("Sign in as the owner to change your notes.");
  }

  return (
    <section className="pixel-frame bg-surface p-4 sm:p-5">
      <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
        what I don&apos;t get yet
      </h2>
      <p className="text-ink-soft mt-1 text-xs">
        the passages you marked amber or red while reading. re-read one and it
        moves.
      </p>
      {marks.length === 0 ? (
        <p className="text-ink-soft mt-3 text-sm">
          Nothing fuzzy on the shelf. Read one at the desk and highlight as you
          go.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {marks.map((h) => (
            <li key={h.id} className="border-line border-b pb-3 last:border-0">
              <MarkedQuote quote={h.quote} note={h.note} grasp={h.grasp} />
              <div className="mt-1 flex items-center justify-between gap-3">
                <Link
                  href={`/daily/read/${h.bookmarkId}`}
                  className="text-ink-soft hover:text-accent min-w-0 flex-1 truncate font-mono text-[11px]"
                >
                  {GRASP_LABEL[h.grasp]} · {h.bookmarkTitle} →
                </Link>
                <button
                  type="button"
                  onClick={() => forget(h.id)}
                  title="I get this now — drop the mark"
                  className="text-ink-soft hover:text-ink shrink-0 font-mono text-[11px]"
                >
                  got it now ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
