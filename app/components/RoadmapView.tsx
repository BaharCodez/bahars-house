"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PatternViz from "./PatternViz";
import DsaStrengthBoard, { type BoardRow } from "./DsaStrengthBoard";
import { DSA_CONTENT } from "@/app/lib/dsaContent";
import { CONFIDENCE_LABEL } from "@/app/lib/dsaStrength";

export interface Step {
  id: string;
  order: number;
  group: string;
  title: string;
  detail: string;
  link: string | null;
  recallQ: string;
  recallA: string;
  done: boolean;
  confidence: number;
}

export type ProblemStatus = "solved" | "struggled";

// Everything logged about one drilled problem, keyed by its LeetCode URL.
export interface ProblemEntry {
  status: ProblemStatus;
  // How hard it felt: 1 brutal → 5 easy, 0 unrated.
  rating: number;
  note: string;
  // Ticked by the LeetCode sync rather than by hand.
  auto: boolean;
}

const RATINGS: { value: 1 | 2 | 3; tint: string }[] = [
  { value: 1, tint: "hl-lost" },
  { value: 2, tint: "hl-half" },
  { value: 3, tint: "hl-got" },
];

// The felt-difficulty scale, dark to light: 1 brutal → 5 easy.
const FELT: { value: number; tint: string }[] = [
  { value: 1, tint: "hl-lost" },
  { value: 2, tint: "hl-lost" },
  { value: 3, tint: "hl-half" },
  { value: 4, tint: "hl-got" },
  { value: 5, tint: "hl-got" },
];

export default function RoadmapView({
  steps: initial,
  canEdit,
  slug,
  problemLog: initialLog = {},
  leetcode = { username: null, syncedAt: null },
}: {
  steps: Step[];
  canEdit: boolean;
  slug?: string;
  problemLog?: Record<string, ProblemEntry>;
  leetcode?: { username: string | null; syncedAt: string | null };
}) {
  const [steps, setSteps] = useState(initial);
  const [problemLog, setProblemLog] = useState(initialLog);
  const [openRecall, setOpenRecall] = useState<Set<string>>(new Set());
  const [openAnswer, setOpenAnswer] = useState<Set<string>>(new Set());
  const [openStudy, setOpenStudy] = useState<Set<string>>(new Set());
  const [openProblem, setOpenProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const isDsa = slug === "dsa";

  // Only the pattern steps carry problems to drill — the "how to grind"
  // preamble isn't a strength or a weakness.
  const boardRows = useMemo<BoardRow[]>(() => {
    if (!isDsa) return [];
    return steps
      .filter((s) => DSA_CONTENT[s.title])
      .map((s) => ({
        stepId: s.id,
        pattern: s.title,
        confidence: s.confidence,
        drills: DSA_CONTENT[s.title].problems
          .map((p) => problemLog[p.url])
          .filter(Boolean)
          .map((entry) => ({
            solved: entry.status === "solved",
            rating: entry.rating,
          })),
      }));
  }, [isDsa, steps, problemLog]);

  // Open a pattern's study panel and walk to it.
  function jumpTo(stepId: string) {
    setOpenStudy((prev) => new Set(prev).add(stepId));
    document
      .getElementById(`step-${stepId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function rateStep(step: Step, value: number) {
    if (!canEdit) {
      setNote("Sign in as the owner to track your progress.");
      return;
    }
    // Clicking the current rating clears it back to unrated.
    const next = step.confidence === value ? 0 : value;
    setSteps((s) =>
      s.map((x) => (x.id === step.id ? { ...x, confidence: next } : x)),
    );
    const res = await fetch(`/api/roadmap-steps/${step.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confidence: next }),
    });
    if (!res.ok) {
      setSteps((s) =>
        s.map((x) =>
          x.id === step.id ? { ...x, confidence: step.confidence } : x,
        ),
      );
      setNote("Couldn't save that — sign in as the owner.");
    }
  }

  /* Send a change to one problem's log and reconcile optimistically. `patch`
     is what the row should look like afterwards, or null to un-log it. */
  async function saveProblem(
    problem: { name: string; url: string },
    pattern: string,
    patch: Partial<ProblemEntry> | null,
    body: Record<string, unknown>,
  ) {
    if (!canEdit) {
      setNote("Sign in as the owner to track your progress.");
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
      setNote("Couldn't save that — sign in as the owner.");
    }
  }

  // ✓ / ✗ — clicking the verdict it already has un-logs it entirely.
  function logProblem(
    problem: { name: string; url: string },
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
  function rateProblem(
    problem: { name: string; url: string },
    pattern: string,
    rating: number,
  ) {
    const next = problemLog[problem.url]?.rating === rating ? 0 : rating;
    return saveProblem(problem, pattern, { rating: next }, { rating: next });
  }

  function noteProblem(
    problem: { name: string; url: string },
    pattern: string,
    text: string,
  ) {
    if ((problemLog[problem.url]?.note ?? "") === text) return;
    return saveProblem(problem, pattern, { note: text }, { note: text });
  }

  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  // The next chunk to do: first one not yet ticked.
  const nextId = steps.find((s) => !s.done)?.id ?? null;

  const cheer =
    pct === 100
      ? "the whole path — done. 🎉"
      : pct === 0
        ? "start with just one chunk. that's the whole trick."
        : `${pct}% of the way — keep chipping.`;

  function toggleSet(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleDone(step: Step) {
    if (!canEdit) {
      setNote("Sign in as the owner to track your progress.");
      return;
    }
    const nextDone = !step.done;
    setSteps((s) =>
      s.map((x) => (x.id === step.id ? { ...x, done: nextDone } : x)),
    );
    const res = await fetch(`/api/roadmap-steps/${step.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: nextDone }),
    });
    if (!res.ok) {
      setSteps((s) =>
        s.map((x) => (x.id === step.id ? { ...x, done: step.done } : x)),
      );
      setNote("Couldn't save that — sign in as the owner.");
    }
  }

  // Precompute where a new group header should appear (no render-time mutation).
  const rows = steps.map((step, i) => ({
    step,
    showGroup: !!step.group && step.group !== (steps[i - 1]?.group ?? ""),
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-20 sm:px-8">
      {/* progress */}
      <div className="border-line bg-surface mb-8 rounded-sm border p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
            your progress
          </span>
          <span className="text-ink font-mono text-sm font-bold">
            {done} / {total}
          </span>
        </div>
        <div className="bg-ink/10 mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-ink-soft mt-2 text-sm">{cheer}</p>
      </div>

      {/* done ≠ solid, so the DSA path also reports where it actually stands */}
      {isDsa && boardRows.length > 0 && (
        <DsaStrengthBoard
          rows={boardRows}
          onJump={jumpTo}
          leetcode={leetcode}
          onSynced={(added) =>
            setProblemLog((log) => {
              const next = { ...log };
              // The sync only ever fills blanks, so nothing here overwrites a
              // verdict you gave by hand.
              for (const p of added) {
                next[p.url] ??= {
                  status: "solved",
                  rating: 0,
                  note: "",
                  auto: true,
                };
              }
              return next;
            })
          }
        />
      )}

      {note && (
        <p className="text-accent-2 mb-4 text-center text-xs font-medium">
          {note}
        </p>
      )}

      {/* the path */}
      <ol className="relative">
        {rows.map(({ step, showGroup }) => {
          const isNext = step.id === nextId;
          return (
            <li key={step.id} id={`step-${step.id}`} className="scroll-mt-24">
              {showGroup && (
                <h3 className="text-accent-2 mt-6 mb-2 font-mono text-[11px] tracking-[0.2em] uppercase first:mt-0">
                  {step.group}
                </h3>
              )}
              <div className="flex gap-3">
                {/* node + connector */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => toggleDone(step)}
                    aria-label={step.done ? "mark not done" : "mark done"}
                    title={
                      canEdit
                        ? step.done
                          ? "tick off"
                          : "mark this chunk done"
                        : "sign in to track progress"
                    }
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] transition-colors ${
                      step.done
                        ? "border-accent bg-accent text-accent-ink"
                        : isNext
                          ? "border-accent text-accent"
                          : "border-line text-transparent"
                    }`}
                  >
                    ✓
                  </button>
                  <span className="bg-line my-1 w-px flex-1" />
                </div>

                {/* content */}
                <div className="min-w-0 flex-1 pb-4">
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
                        className={`hl ${
                          RATINGS.find((r) => r.value === step.confidence)?.tint
                        } rounded-sm px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase`}
                      >
                        {CONFIDENCE_LABEL[step.confidence as 1 | 2 | 3]}
                      </span>
                    )}
                  </div>
                  {step.detail && (
                    <p className="text-ink-soft mt-1 text-sm">{step.detail}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {step.link &&
                      (step.link.startsWith("/") ? (
                        // In-app link (e.g. a book section) — open in the study.
                        <Link
                          href={step.link}
                          className="text-accent font-mono text-xs hover:underline"
                        >
                          read it →
                        </Link>
                      ) : (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent font-mono text-xs hover:underline"
                        >
                          read it ↗
                        </a>
                      ))}
                    {isDsa && DSA_CONTENT[step.title] && (
                      <button
                        type="button"
                        onClick={() => toggleSet(setOpenStudy, step.id)}
                        className="text-ink-soft hover:text-ink font-mono text-xs"
                      >
                        {openStudy.has(step.id) ? "hide" : "▸ study"}
                      </button>
                    )}
                    {step.recallQ && (
                      <button
                        type="button"
                        onClick={() => toggleSet(setOpenRecall, step.id)}
                        className="text-ink-soft hover:text-ink font-mono text-xs"
                      >
                        🧠 {openRecall.has(step.id) ? "hide" : "test yourself"}
                      </button>
                    )}
                  </div>

                  {isDsa &&
                    DSA_CONTENT[step.title] &&
                    openStudy.has(step.id) && (
                      <div className="border-line bg-bg-2/40 fade-up mt-2 space-y-3 rounded-sm border p-3">
                        {DSA_CONTENT[step.title].viz && (
                          <div className="flex justify-center py-2">
                            <PatternViz kind={DSA_CONTENT[step.title].viz!} />
                          </div>
                        )}
                        <pre className="text-ink overflow-x-auto rounded-sm bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] p-3 font-mono text-xs leading-relaxed">
                          {DSA_CONTENT[step.title].template}
                        </pre>
                        {/* drill it, then say honestly how it went */}
                        <ul className="space-y-1">
                          {DSA_CONTENT[step.title].problems.map((p) => {
                            const entry = problemLog[p.url];
                            const open = openProblem === p.url;
                            return (
                              <li key={p.url}>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-ink hover:text-accent min-w-0 flex-1 truncate font-mono text-[11px] hover:underline"
                                  >
                                    {p.name} ↗
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      logProblem(p, step.title, "solved")
                                    }
                                    title="came out on its own"
                                    className={`rounded-sm px-2 py-0.5 font-mono text-[11px] ${
                                      entry?.status === "solved"
                                        ? "hl hl-got"
                                        : "text-ink-soft hover:text-ink"
                                    }`}
                                  >
                                    ✓ solved
                                    {entry?.auto && (
                                      <span className="opacity-60">
                                        {" "}
                                        (auto)
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      logProblem(p, step.title, "struggled")
                                    }
                                    title="needed the answer, or crawled"
                                    className={`rounded-sm px-2 py-0.5 font-mono text-[11px] ${
                                      entry?.status === "struggled"
                                        ? "hl hl-lost"
                                        : "text-ink-soft hover:text-ink"
                                    }`}
                                  >
                                    ✗ struggled
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenProblem(open ? null : p.url)
                                    }
                                    title="how hard did it feel, and your notes"
                                    className="text-ink-soft hover:text-ink shrink-0 font-mono text-[11px]"
                                  >
                                    {entry?.rating ? `${entry.rating}/5` : "✎"}
                                    {entry?.note && !open && " ·"}
                                  </button>
                                </div>

                                {/* your own rating and notes — LeetCode keeps
                                    its notes behind its login, so these live
                                    here */}
                                {open && (
                                  <div className="border-line bg-surface/60 fade-up mt-1 mb-2 rounded-sm border p-2">
                                    {entry ? (
                                      <>
                                        <div className="flex flex-wrap items-center gap-1">
                                          <span className="text-ink-soft mr-1 font-mono text-[11px]">
                                            how hard did it feel?
                                          </span>
                                          {FELT.map((f) => (
                                            <button
                                              key={f.value}
                                              type="button"
                                              onClick={() =>
                                                rateProblem(
                                                  p,
                                                  step.title,
                                                  f.value,
                                                )
                                              }
                                              className={`rounded-sm px-2 py-0.5 font-mono text-[11px] ${
                                                entry.rating === f.value
                                                  ? `hl ${f.tint}`
                                                  : "text-ink-soft hover:text-ink"
                                              }`}
                                            >
                                              {f.value}
                                            </button>
                                          ))}
                                          <span className="text-ink-soft ml-1 font-mono text-[10px]">
                                            1 brutal · 5 easy
                                          </span>
                                        </div>
                                        <textarea
                                          defaultValue={entry.note}
                                          onBlur={(e) =>
                                            noteProblem(
                                              p,
                                              step.title,
                                              e.target.value,
                                            )
                                          }
                                          rows={3}
                                          placeholder="what tripped you up, the trick you missed, the invariant…"
                                          className="border-line text-ink focus:border-accent mt-2 w-full resize-y rounded-sm border bg-transparent px-2 py-1 text-xs outline-none"
                                        />
                                      </>
                                    ) : (
                                      <p className="text-ink-soft font-mono text-[11px]">
                                        mark it ✓ solved or ✗ struggled first —
                                        then rate it and write it up.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>

                        {/* the honest half: could you write it cold? */}
                        <div className="border-line flex flex-wrap items-center gap-2 border-t pt-3">
                          <span className="text-ink-soft font-mono text-[11px]">
                            could you write it cold?
                          </span>
                          {RATINGS.map((r) => (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => rateStep(step, r.value)}
                              className={`rounded-sm px-2 py-0.5 font-mono text-[11px] ${
                                step.confidence === r.value
                                  ? `hl ${r.tint}`
                                  : "text-ink-soft hover:text-ink"
                              }`}
                            >
                              {CONFIDENCE_LABEL[r.value]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {step.recallQ && openRecall.has(step.id) && (
                    <div className="border-line bg-bg-2/40 mt-2 rounded-sm border p-3">
                      <p className="text-ink text-sm italic">{step.recallQ}</p>
                      {openAnswer.has(step.id) ? (
                        <p className="text-ink-soft mt-2 text-sm leading-relaxed whitespace-pre-line">
                          {step.recallA}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSet(setOpenAnswer, step.id)}
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
        })}
      </ol>

      {done === total && total > 0 && (
        <p className="text-ink mt-4 text-center font-serif text-lg">
          You finished the whole path. 🎉
        </p>
      )}

      {!canEdit && (
        <p className="text-ink-soft mt-8 text-center font-mono text-xs">
          <Link href="/login" className="text-accent hover:underline">
            sign in
          </Link>{" "}
          as the owner to track your progress.
        </p>
      )}
    </div>
  );
}
