/**
 * Reading the DSA roadmap as strong and weak points.
 *
 * Two signals, because either one alone lies. A self-rating is honest about
 * whether you could write the pattern cold but flatters you the week after
 * reading it; a solved/struggled tally is hard evidence but says nothing
 * about the patterns you've been avoiding. Untested is its own answer — a
 * blank is a gap, not a strength.
 */

export type Confidence = 0 | 1 | 2 | 3; // unrated, lost, shaky, solid

export const CONFIDENCE_LABEL: Record<Exclude<Confidence, 0>, string> = {
  1: "lost",
  2: "shaky",
  3: "solid",
};

// One drilled problem: did it come out, and how hard did it feel on the
// 1 brutal → 5 easy scale (0 = not rated).
export interface Drill {
  solved: boolean;
  rating: number;
}

export interface PatternStat {
  pattern: string;
  confidence: number;
  drills: Drill[];
}

/* What one drilled problem says about the pattern, 0–1.

   Solving something that felt brutal isn't the same as solving something that
   felt obvious — the first means you got there, the second means you own it —
   so a solve lands between 0.5 and 1 depending on how it felt. A struggle
   still counts for a little: you've met the pattern, which beats never having
   tried it. */
function drillScore(d: Drill): number {
  if (!d.solved) return 0.15;
  if (!d.rating) return 0.75;
  return 0.5 + ((d.rating - 1) / 4) * 0.5;
}

export function tally(s: PatternStat) {
  const solved = s.drills.filter((d) => d.solved).length;
  const rated = s.drills.filter((d) => d.rating > 0);
  return {
    solved,
    total: s.drills.length,
    // Mean felt-difficulty, or null when nothing's been rated.
    felt: rated.length
      ? rated.reduce((sum, d) => sum + d.rating, 0) / rated.length
      : null,
  };
}

export type Band = "strong" | "shaky" | "weak" | "untested";

// The rating carries more weight than the tally: "I could write this cold" is
// the thing an interview actually asks for, and a solved count says nothing
// about how long it took.
const RATING_WEIGHT = 0.6;

/** 0–1, or null when there's nothing to go on yet. */
export function strengthOf(s: PatternStat): number | null {
  const rated = s.confidence > 0 ? (s.confidence - 1) / 2 : null;
  const drilled = s.drills.length
    ? s.drills.reduce((sum, d) => sum + drillScore(d), 0) / s.drills.length
    : null;

  if (rated !== null && drilled !== null) {
    return RATING_WEIGHT * rated + (1 - RATING_WEIGHT) * drilled;
  }
  return rated ?? drilled;
}

export function bandOf(strength: number | null): Band {
  if (strength === null) return "untested";
  if (strength >= 0.7) return "strong";
  if (strength >= 0.4) return "shaky";
  return "weak";
}

export const BAND_TINT: Record<Band, string> = {
  strong: "hl-got",
  shaky: "hl-half",
  weak: "hl-lost",
  untested: "",
};

/** Weakest first — the board is a to-do list, not a trophy shelf. */
export function rankPatterns<T extends PatternStat>(stats: T[]) {
  return [...stats].sort((a, b) => {
    const sa = strengthOf(a);
    const sb = strengthOf(b);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1; // untested sits after the rated ones
    if (sb === null) return -1;
    return sa - sb;
  });
}
