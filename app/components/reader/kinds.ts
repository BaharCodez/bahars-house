import type { AnnotationKind } from "@/app/lib/types";

// The four kinds of mark. Plain words, one glyph each, and no more than four —
// categorising has to be a single tap you can make without losing the thread
// of the sentence you're reading.
export const KIND_META: Record<
  AnnotationKind,
  { label: string; glyph: string; fill: string }
> = {
  idea: { label: "key idea", glyph: "💡", fill: "#d9a318" },
  definition: { label: "definition", glyph: "📖", fill: "#4f7fd1" },
  example: { label: "example", glyph: "🔧", fill: "#4f9d5d" },
  question: { label: "question", glyph: "❓", fill: "#9a6cc4" },
};

export const KIND_ORDER: AnnotationKind[] = [
  "idea",
  "definition",
  "example",
  "question",
];
