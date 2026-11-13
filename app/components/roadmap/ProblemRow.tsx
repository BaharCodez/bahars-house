"use client";

import {
  FELT_DIFFICULTY,
  RATING_BUTTON,
  RATING_IDLE,
} from "./ratings";
import type { DrillProblem, ProblemEntry } from "./types";
import type { ProblemActions } from "./useRoadmapProgress";

/* One problem to drill: the verdict buttons, and a drawer for how hard it
   felt and your notes. */
export default function ProblemRow({
  problem,
  pattern,
  entry,
  open,
  onToggleOpen,
  actions,
}: {
  problem: DrillProblem;
  pattern: string;
  entry: ProblemEntry | undefined;
  open: boolean;
  onToggleOpen: () => void;
  actions: ProblemActions;
}) {
  return (
    <li>
      <div className="flex items-center gap-2">
        <a
          href={problem.url}
          target="_blank"
          rel="noreferrer"
          className="text-ink hover:text-accent min-w-0 flex-1 truncate font-mono text-[11px] hover:underline"
        >
          {problem.name} ↗
        </a>
        <button
          type="button"
          onClick={() => actions.logProblem(problem, pattern, "solved")}
          title="came out on its own"
          className={`${RATING_BUTTON} ${
            entry?.status === "solved" ? "hl hl-got" : RATING_IDLE
          }`}
        >
          ✓ solved
          {entry?.auto && <span className="opacity-60"> (auto)</span>}
        </button>
        <button
          type="button"
          onClick={() => actions.logProblem(problem, pattern, "struggled")}
          title="needed the answer, or crawled"
          className={`${RATING_BUTTON} ${
            entry?.status === "struggled" ? "hl hl-lost" : RATING_IDLE
          }`}
        >
          ✗ struggled
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          title="how hard did it feel, and your notes"
          className="text-ink-soft hover:text-ink shrink-0 font-mono text-[11px]"
        >
          {entry?.rating ? `${entry.rating}/5` : "✎"}
          {entry?.note && !open && " ·"}
        </button>
      </div>

      {/* LeetCode keeps its notes behind its login, so these live here. */}
      {open && (
        <div className="border-line bg-surface/60 fade-up mt-1 mb-2 rounded-sm border p-2">
          {entry ? (
            <ProblemNotes
              problem={problem}
              pattern={pattern}
              entry={entry}
              actions={actions}
            />
          ) : (
            <p className="text-ink-soft font-mono text-[11px]">
              mark it ✓ solved or ✗ struggled first — then rate it and write it
              up.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function ProblemNotes({
  problem,
  pattern,
  entry,
  actions,
}: {
  problem: DrillProblem;
  pattern: string;
  entry: ProblemEntry;
  actions: ProblemActions;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-ink-soft mr-1 font-mono text-[11px]">
          how hard did it feel?
        </span>
        {FELT_DIFFICULTY.map((felt) => (
          <button
            key={felt.value}
            type="button"
            onClick={() => actions.rateProblem(problem, pattern, felt.value)}
            className={`${RATING_BUTTON} ${
              entry.rating === felt.value ? `hl ${felt.tint}` : RATING_IDLE
            }`}
          >
            {felt.value}
          </button>
        ))}
        <span className="text-ink-soft ml-1 font-mono text-[10px]">
          1 brutal · 5 easy
        </span>
      </div>
      <textarea
        defaultValue={entry.note}
        onBlur={(e) => actions.noteProblem(problem, pattern, e.target.value)}
        rows={3}
        placeholder="what tripped you up, the trick you missed, the invariant…"
        className="border-line text-ink focus:border-accent mt-2 w-full resize-y rounded-sm border bg-transparent px-2 py-1 text-xs outline-none"
      />
    </>
  );
}
