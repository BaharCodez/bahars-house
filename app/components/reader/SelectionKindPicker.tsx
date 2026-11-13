"use client";

import type { AnnotationKind } from "@/app/lib/types";
import { KIND_META, KIND_ORDER } from "./kinds";

// Buttons only: opening a text composer (and the keyboard) mid-selection
// collapses the selection on iOS.
export default function SelectionKindPicker({
  onPick,
  onDismiss,
}: {
  onPick: (kind: AnnotationKind) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="border-line bg-surface absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-2xl border p-2 shadow-xl select-none [-webkit-touch-callout:none]">
      <p className="text-ink-soft px-1 pb-1.5 text-center font-mono text-[10px] tracking-[0.15em] uppercase">
        what is this?
      </p>
      <div className="flex gap-1">
        {KIND_ORDER.map((kind) => (
          <button
            key={kind}
            onClick={() => onPick(kind)}
            title={`Mark as ${KIND_META[kind].label}`}
            className={`hl hl-${kind} text-ink flex w-[4.5rem] flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] leading-tight`}
          >
            <span className="text-base">{KIND_META[kind].glyph}</span>
            {KIND_META[kind].label}
          </button>
        ))}
      </div>
      <button
        onClick={onDismiss}
        className="text-ink-soft hover:text-ink mt-1 w-full text-center font-mono text-[10px]"
      >
        never mind
      </button>
    </div>
  );
}
