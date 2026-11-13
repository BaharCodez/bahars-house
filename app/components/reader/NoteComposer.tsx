"use client";

import type { Annotation, AnnotationKind } from "@/app/lib/types";
import { KIND_META } from "./kinds";

const DEFAULT_PROMPT = "why does this matter? (optional)";
const PROMPT_BY_KIND: Partial<Record<AnnotationKind, string>> = {
  question: "what don't you understand yet?",
  definition: "say it back in your own words…",
};

interface NoteComposerProps {
  annotation: Annotation;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSkip: () => void;
  onSave: () => void;
}

// The mark itself already exists by now: categorising saves it, and the note
// is an optional afterthought.
export default function NoteComposer({
  annotation,
  draft,
  onDraftChange,
  onSkip,
  onSave,
}: NoteComposerProps) {
  const { kind, text } = annotation;
  return (
    <div className="border-line border-b p-4">
      <p className="text-ink-soft mb-2 text-[11px]">
        <span className={`hl hl-${kind} text-ink px-1.5 py-0.5`}>
          {KIND_META[kind].glyph} {KIND_META[kind].label}
        </span>{" "}
        saved
      </p>
      <p className="border-accent text-ink-soft mb-2 border-l-2 pl-2 text-sm italic">
        “{text}”
      </p>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={PROMPT_BY_KIND[kind] ?? DEFAULT_PROMPT}
        className="border-line text-ink focus:border-accent h-20 w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-ink-soft font-mono text-[10px]">
          the mark is already saved
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSkip}
            className="text-ink hover:text-accent rounded-md px-2 py-1.5 text-sm"
          >
            Skip
          </button>
          <button
            onClick={onSave}
            className="bg-accent text-accent-ink rounded-full px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
