"use client";

import type { Annotation, AnnotationKind } from "@/app/lib/types";
import { KIND_META, KIND_ORDER } from "./kinds";

interface HighlightCardProps {
  annotation: Annotation;
  onRecategorise: (kind: AnnotationKind) => void;
  onEditNote: () => void;
  onClose: () => void;
}

// Shown when you tap a highlight in the book.
export default function HighlightCard({
  annotation,
  onRecategorise,
  onEditNote,
  onClose,
}: HighlightCardProps) {
  const { text, comment, mine, kind, authorName } = annotation;
  return (
    <div className="border-line bg-surface absolute inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-xl border p-3 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-ink-soft border-l-2 pl-2 text-sm italic ${
            mine ? "border-accent" : "border-blue-400"
          }`}
        >
          “{text}”
        </p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-ink hover:text-accent shrink-0"
        >
          ✕
        </button>
      </div>
      {comment ? (
        <p className="text-ink mt-2 text-sm">{comment}</p>
      ) : (
        <p className="text-ink-soft mt-2 text-xs italic">
          No note on this highlight.
        </p>
      )}
      {mine && (
        <div className="mt-2 flex gap-1">
          {KIND_ORDER.map((option) => (
            <button
              key={option}
              onClick={() => onRecategorise(option)}
              title={`Mark as ${KIND_META[option].label}`}
              className={`flex-1 rounded-md px-1 py-1 text-[10px] leading-tight transition-colors ${
                kind === option
                  ? `hl hl-${option} text-ink ring-accent ring-1`
                  : "text-ink hover:bg-bg"
              }`}
            >
              {KIND_META[option].glyph} {KIND_META[option].label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-ink-soft text-xs">— {mine ? "You" : authorName}</p>
        {mine && (
          <button
            onClick={onEditNote}
            className="text-ink hover:text-accent font-mono text-[11px]"
          >
            {comment ? "edit note" : "add a note"} →
          </button>
        )}
      </div>
    </div>
  );
}
