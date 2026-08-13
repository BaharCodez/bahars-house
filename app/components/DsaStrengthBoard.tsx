"use client";

import LeetCodeSync, { type SyncedProblem } from "./LeetCodeSync";
import {
  BAND_TINT,
  CONFIDENCE_LABEL,
  bandOf,
  rankPatterns,
  strengthOf,
  tally,
  type Band,
  type PatternStat,
} from "@/app/lib/dsaStrength";

export interface BoardRow extends PatternStat {
  stepId: string;
}

const BAND_HEADING: Record<Band, string> = {
  weak: "needs work",
  shaky: "shaky ground",
  strong: "solid",
  untested: "not tested yet",
};

/**
 * The DSA roadmap read back as strong and weak points: every pattern ranked
 * weakest first, so the next hour of practice picks itself.
 */
export default function DsaStrengthBoard({
  rows,
  onJump,
  leetcode,
  onSynced,
}: {
  rows: BoardRow[];
  onJump: (stepId: string) => void;
  leetcode: { username: string | null; syncedAt: string | null };
  onSynced: (added: SyncedProblem[]) => void;
}) {
  const ranked = rankPatterns(rows);
  const byBand: Record<Band, BoardRow[]> = {
    weak: [],
    shaky: [],
    strong: [],
    untested: [],
  };
  for (const row of ranked) byBand[bandOf(strengthOf(row))].push(row);

  const tallyLine = (["strong", "shaky", "weak", "untested"] as Band[])
    .filter((b) => byBand[b].length)
    .map((b) => `${byBand[b].length} ${BAND_HEADING[b]}`)
    .join(" · ");

  function line(row: BoardRow) {
    const strength = strengthOf(row);
    const band = bandOf(strength);
    const { solved, total, felt } = tally(row);
    const rated =
      row.confidence > 0
        ? CONFIDENCE_LABEL[row.confidence as 1 | 2 | 3]
        : "unrated";

    return (
      <li key={row.stepId} className="flex items-center gap-3 py-1">
        <button
          type="button"
          onClick={() => onJump(row.stepId)}
          className="text-ink hover:text-accent min-w-0 flex-1 truncate text-left font-serif text-sm"
          title="jump to this pattern"
        >
          {row.pattern}
        </button>
        <span className="bg-ink/10 hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full sm:block">
          {strength !== null && (
            <span
              className={`hl ${BAND_TINT[band]} block h-full rounded-full`}
              style={{ width: `${Math.max(6, Math.round(strength * 100))}%` }}
            />
          )}
        </span>
        <span className="text-ink-soft w-36 shrink-0 text-right font-mono text-[11px]">
          {rated}
          {total > 0 && ` · ${solved}/${total}`}
          {felt !== null && ` · felt ${felt.toFixed(1)}`}
        </span>
      </li>
    );
  }

  return (
    <div className="border-line bg-surface mb-8 rounded-sm border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
          strong &amp; weak points
        </span>
        <span className="text-ink-soft font-mono text-[11px]">{tallyLine}</span>
      </div>
      <p className="text-ink-soft mt-2 text-sm">
        Rate a pattern after you drill it, and mark each problem solved or
        struggled. Weakest first — that&apos;s the next hour of practice.
      </p>

      <LeetCodeSync
        username={leetcode.username}
        syncedAt={leetcode.syncedAt}
        onSynced={onSynced}
      />

      {(["weak", "shaky", "strong"] as Band[]).map((band) =>
        byBand[band].length ? (
          <div key={band} className="mt-4">
            <h3
              className={`text-ink-soft inline-block rounded-sm px-1 font-mono text-[11px] tracking-[0.2em] uppercase ${
                band === "strong" ? "" : `hl ${BAND_TINT[band]}`
              }`}
            >
              {BAND_HEADING[band]}
            </h3>
            <ul className="mt-1">{byBand[band].map(line)}</ul>
          </div>
        ) : null,
      )}

      {byBand.untested.length > 0 && (
        <div className="mt-4">
          <h3 className="text-ink-soft font-mono text-[11px] tracking-[0.2em] uppercase">
            {BAND_HEADING.untested}
          </h3>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
            {byBand.untested.map((row) => (
              <button
                key={row.stepId}
                type="button"
                onClick={() => onJump(row.stepId)}
                className="text-ink-soft hover:text-accent text-sm underline-offset-4 hover:underline"
              >
                {row.pattern}
              </button>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
