"use client";

import PatternViz from "../PatternViz";
import type { PatternContent } from "@/app/lib/dsaContent";
import { CONFIDENCE_LABEL } from "@/app/lib/dsaStrength";
import ProblemRow from "./ProblemRow";
import { CONFIDENCE_RATINGS, RATING_BUTTON, RATING_IDLE } from "./ratings";
import type { ProblemEntry, Step } from "./types";
import type { ProblemActions } from "./useRoadmapProgress";

/* A DSA pattern's study material: the picture, the template, problems to
   drill, and the honest question of whether you could write it cold. */
export default function StudyPanel({
  step,
  content,
  problemLog,
  openProblemUrl,
  onOpenProblem,
  actions,
  onRate,
}: {
  step: Step;
  content: PatternContent;
  problemLog: Record<string, ProblemEntry>;
  openProblemUrl: string | null;
  onOpenProblem: (url: string | null) => void;
  actions: ProblemActions;
  onRate: (value: number) => void;
}) {
  return (
    <div className="border-line bg-bg-2/40 fade-up mt-2 space-y-3 rounded-sm border p-3">
      {content.viz && (
        <div className="flex justify-center py-2">
          <PatternViz kind={content.viz} />
        </div>
      )}
      <pre className="text-ink overflow-x-auto rounded-sm bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] p-3 font-mono text-xs leading-relaxed">
        {content.template}
      </pre>
      <ul className="space-y-1">
        {content.problems.map((problem) => {
          const open = openProblemUrl === problem.url;
          return (
            <ProblemRow
              key={problem.url}
              problem={problem}
              pattern={step.title}
              entry={problemLog[problem.url]}
              open={open}
              onToggleOpen={() => onOpenProblem(open ? null : problem.url)}
              actions={actions}
            />
          );
        })}
      </ul>

      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-ink-soft font-mono text-[11px]">
          could you write it cold?
        </span>
        {CONFIDENCE_RATINGS.map((rating) => (
          <button
            key={rating.value}
            type="button"
            onClick={() => onRate(rating.value)}
            className={`${RATING_BUTTON} ${
              step.confidence === rating.value
                ? `hl ${rating.tint}`
                : RATING_IDLE
            }`}
          >
            {CONFIDENCE_LABEL[rating.value]}
          </button>
        ))}
      </div>
    </div>
  );
}
