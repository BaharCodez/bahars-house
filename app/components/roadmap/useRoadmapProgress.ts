"use client";

import { useState } from "react";
import type { SyncedProblem } from "../LeetCodeSync";
import type {
  DrillProblem,
  ProblemEntry,
  ProblemStatus,
  Step,
} from "./types";

const SIGN_IN_TO_TRACK = "Sign in as the owner to track your progress.";
const SAVE_REFUSED = "Couldn't save that — sign in as the owner.";

type StepPatch = Partial<Pick<Step, "done" | "confidence">>;

/* Ticks, ratings and the problem log, saved optimistically and rolled back
   if the server refuses. Visitors only ever get the sign-in note. */
export function useRoadmapProgress({
  initialSteps,
  initialLog,
  canEdit,
}: {
  initialSteps: Step[];
  initialLog: Record<string, ProblemEntry>;
  canEdit: boolean;
}) {
  const [steps, setSteps] = useState(initialSteps);
  const [problemLog, setProblemLog] = useState(initialLog);
  const [note, setNote] = useState<string | null>(null);

  function patchLocalStep(id: string, patch: StepPatch) {
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function saveStep(step: Step, patch: StepPatch) {
    if (!canEdit) {
      setNote(SIGN_IN_TO_TRACK);
      return;
    }
    const rollback = Object.fromEntries(
      Object.keys(patch).map((key) => [key, step[key as keyof StepPatch]]),
    ) as StepPatch;
    patchLocalStep(step.id, patch);
    const res = await fetch(`/api/roadmap-steps/${step.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      patchLocalStep(step.id, rollback);
      setNote(SAVE_REFUSED);
    }
  }

  function toggleDone(step: Step) {
    return saveStep(step, { done: !step.done });
  }

  // Clicking the current rating clears it back to unrated.
  function rateStep(step: Step, value: number) {
    return saveStep(step, {
      confidence: step.confidence === value ? 0 : value,
    });
  }

  /* Send a change to one problem's log and reconcile optimistically. `patch`
     is what the row should look like afterwards, or null to un-log it. */
  async function saveProblem(
    problem: DrillProblem,
    pattern: string,
    patch: Partial<ProblemEntry> | null,
    body: Record<string, unknown>,
  ) {
    if (!canEdit) {
      setNote(SIGN_IN_TO_TRACK);
      return;
    }
    const before = problemLog[problem.url];
    setProblemLog((log) => {
      const copy = { ...log };
      if (patch === null) delete copy[problem.url];
      else {
        // A brand-new row only ever starts from a verdict, so the fallback
        // here is just to satisfy the shape — `patch` carries the truth.
        const base: ProblemEntry = before ?? {
          status: "solved",
          rating: 0,
          note: "",
          auto: false,
        };
        copy[problem.url] = { ...base, ...patch };
      }
      return copy;
    });

    const res = await fetch("/api/problem-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: problem.url,
        name: problem.name,
        pattern,
        ...body,
      }),
    });
    if (!res.ok) {
      setProblemLog((log) => {
        const copy = { ...log };
        if (before) copy[problem.url] = before;
        else delete copy[problem.url];
        return copy;
      });
      setNote(SAVE_REFUSED);
    }
  }

  // ✓ / ✗ — clicking the verdict it already has un-logs it entirely.
  function logProblem(
    problem: DrillProblem,
    pattern: string,
    status: ProblemStatus,
  ) {
    const clearing = problemLog[problem.url]?.status === status;
    return saveProblem(
      problem,
      pattern,
      // A hand-set verdict is yours, not the sync's.
      clearing ? null : { status, auto: false },
      { status: clearing ? "clear" : status },
    );
  }

  // How hard it felt, 1 brutal → 5 easy. Clicking the same number clears it.
  function rateProblem(problem: DrillProblem, pattern: string, rating: number) {
    const next = problemLog[problem.url]?.rating === rating ? 0 : rating;
    return saveProblem(problem, pattern, { rating: next }, { rating: next });
  }

  function noteProblem(problem: DrillProblem, pattern: string, text: string) {
    if ((problemLog[problem.url]?.note ?? "") === text) return;
    return saveProblem(problem, pattern, { note: text }, { note: text });
  }

  // The sync only ever fills blanks, so nothing here overwrites a verdict
  // you gave by hand.
  function addSyncedProblems(added: SyncedProblem[]) {
    setProblemLog((log) => {
      const next = { ...log };
      for (const p of added) {
        next[p.url] ??= {
          status: "solved",
          rating: 0,
          note: "",
          auto: true,
        };
      }
      return next;
    });
  }

  return {
    steps,
    problemLog,
    note,
    toggleDone,
    rateStep,
    logProblem,
    rateProblem,
    noteProblem,
    addSyncedProblems,
  };
}

export type ProblemActions = Pick<
  ReturnType<typeof useRoadmapProgress>,
  "logProblem" | "rateProblem" | "noteProblem"
>;
