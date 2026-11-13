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

export interface DrillProblem {
  name: string;
  url: string;
}
