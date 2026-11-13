"use client";

import { useState } from "react";
import Link from "next/link";
import type { PatternContent } from "@/app/lib/dsaContent";
import { CONFIDENCE_LABEL } from "@/app/lib/dsaStrength";
import { CONFIDENCE_RATINGS } from "./ratings";
import StudyPanel from "./StudyPanel";
import type { ProblemEntry, Step } from "./types";
import type { ProblemActions } from "./useRoadmapProgress";

/* One chunk on the path: its tick-off node, what to read, and the study and
   recall panels it can open. */
export default function RoadmapStepItem({
  step,
  showGroup,
  isNext,
  canEdit,
  study,
  studyOpen,
  onToggleStudy,
  onToggleDone,
  onRate,
  problemLog,
  openProblemUrl,
  onOpenProblem,
  problemActions,
}: {
  step: Step;
  showGroup: boolean;
  isNext: boolean;
  canEdit: boolean;
  // Study material, for DSA pattern steps only.
  study: PatternContent | undefined;
  studyOpen: boolean;
  onToggleStudy: () => void;
  onToggleDone: () => void;
  onRate: (value: number) => void;
  problemLog: Record<string, ProblemEntry>;
  openProblemUrl: string | null;
  onOpenProblem: (url: string | null) => void;
  problemActions: ProblemActions;
}) {
  const [recallOpen, setRecallOpen] = useState(false);
  const [answerShown, setAnswerShown] = useState(false);

  return (
    <li id={`step-${step.id}`} className="scroll-mt-24">
      {showGroup && (
        <h3 className="text-accent-2 mt-6 mb-2 font-mono text-[11px] tracking-[0.2em] uppercase first:mt-0">
          {step.group}
        </h3>
      )}
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <DoneNode
            step={step}
            isNext={isNext}
            canEdit={canEdit}
            onToggle={onToggleDone}
          />
          <span className="bg-line my-1 w-px flex-1" />
        </div>

        <div className="min-w-0 flex-1 pb-4">
          <StepTitle step={step} isNext={isNext} />
          {step.detail && (
            <p className="text-ink-soft mt-1 text-sm">{step.detail}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {step.link && <ReadLink href={step.link} />}
            {study && (
              <button
                type="button"
                onClick={onToggleStudy}
                className="text-ink-soft hover:text-ink font-mono text-xs"
              >
                {studyOpen ? "hide" : "▸ study"}
              </button>
            )}
            {step.recallQ && (
              <button
                type="button"
                onClick={() => setRecallOpen((open) => !open)}
                className="text-ink-soft hover:text-ink font-mono text-xs"
              >
                🧠 {recallOpen ? "hide" : "test yourself"}
              </button>
            )}
          </div>

          {study && studyOpen && (
            <StudyPanel
              step={step}
              content={study}
              problemLog={problemLog}
              openProblemUrl={openProblemUrl}
              onOpenProblem={onOpenProblem}
              actions={problemActions}
              onRate={onRate}
            />
          )}

          {step.recallQ && recallOpen && (
            <div className="border-line bg-bg-2/40 mt-2 rounded-sm border p-3">
              <p className="text-ink text-sm italic">{step.recallQ}</p>
              {answerShown ? (
                <p className="text-ink-soft mt-2 text-sm leading-relaxed whitespace-pre-line">
                  {step.recallA}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setAnswerShown(true)}
                  className="text-accent mt-2 font-mono text-xs hover:underline"
                >
                  reveal answer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function doneNodeTitle(canEdit: boolean, done: boolean) {
  if (!canEdit) return "sign in to track progress";
  return done ? "tick off" : "mark this chunk done";
}

function doneNodeTone(done: boolean, isNext: boolean) {
  if (done) return "border-accent bg-accent text-accent-ink";
  if (isNext) return "border-accent text-accent";
  return "border-line text-transparent";
}

function DoneNode({
  step,
  isNext,
  canEdit,
  onToggle,
}: {
  step: Step;
  isNext: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={step.done ? "mark not done" : "mark done"}
      title={doneNodeTitle(canEdit, step.done)}
      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] transition-colors ${doneNodeTone(
        step.done,
        isNext,
      )}`}
    >
      ✓
    </button>
  );
}

function StepTitle({ step, isNext }: { step: Step; isNext: boolean }) {
  const confidenceTint = CONFIDENCE_RATINGS.find(
    (r) => r.value === step.confidence,
  )?.tint;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`font-serif text-base ${
          step.done ? "text-ink-soft line-through" : "text-ink"
        }`}
      >
        {step.title}
      </span>
      {isNext && (
        <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase">
          up next
        </span>
      )}
      {step.confidence > 0 && (
        <span
          className={`hl ${confidenceTint} rounded-sm px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase`}
        >
          {CONFIDENCE_LABEL[step.confidence as 1 | 2 | 3]}
        </span>
      )}
    </div>
  );
}

const READ_LINK = "text-accent font-mono text-xs hover:underline";

function ReadLink({ href }: { href: string }) {
  // In-app links (e.g. a book section) open in the study.
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={READ_LINK}>
        read it →
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={READ_LINK}>
      read it ↗
    </a>
  );
}
