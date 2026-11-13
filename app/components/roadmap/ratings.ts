export const CONFIDENCE_RATINGS: { value: 1 | 2 | 3; tint: string }[] = [
  { value: 1, tint: "hl-lost" },
  { value: 2, tint: "hl-half" },
  { value: 3, tint: "hl-got" },
];

// The felt-difficulty scale, dark to light: 1 brutal → 5 easy.
export const FELT_DIFFICULTY: { value: number; tint: string }[] = [
  { value: 1, tint: "hl-lost" },
  { value: 2, tint: "hl-lost" },
  { value: 3, tint: "hl-half" },
  { value: 4, tint: "hl-got" },
  { value: 5, tint: "hl-got" },
];

export const RATING_BUTTON =
  "rounded-sm px-2 py-0.5 font-mono text-[11px]";
export const RATING_IDLE = "text-ink-soft hover:text-ink";
