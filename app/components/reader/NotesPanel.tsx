"use client";

import { useState, type ReactNode } from "react";
import type { Annotation, AnnotationKind } from "@/app/lib/types";
import { KIND_META, KIND_ORDER } from "./kinds";

const FILTER_CHIP = "rounded-full px-2 py-1 font-mono text-[10px] transition-colors";
const IDLE_CHIP = "border-line text-ink hover:bg-bg border";

interface NotesPanelProps {
  open: boolean;
  keyboardInset: number;
  annotations: Annotation[];
  notice: string | null;
  // The note composer, while a note is being written.
  composer: ReactNode;
  onDismissNotice: () => void;
  onClose: () => void;
  onJumpTo: (cfiRange: string) => void;
  onEditNote: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
}

// A bottom sheet toggled open on mobile; always the side column on desktop.
export default function NotesPanel({
  open,
  keyboardInset,
  annotations,
  notice,
  composer,
  onDismissNotice,
  onClose,
  onJumpTo,
  onEditNote,
  onDelete,
}: NotesPanelProps) {
  // The review side of the feature, and the reason categorising is worth the
  // tap.
  const [kindFilter, setKindFilter] = useState<AnnotationKind | null>(null);
  const shownNotes = kindFilter
    ? annotations.filter((a) => a.kind === kindFilter)
    : annotations;

  return (
    <aside
      className={`${open ? "flex" : "hidden"} border-line bg-surface fixed inset-x-0 bottom-0 z-20 max-h-[65%] flex-col rounded-t-2xl border-t shadow-2xl sm:static sm:max-h-none! sm:w-80 sm:shrink-0 sm:transform-none! sm:rounded-none sm:border-t-0 sm:border-l sm:shadow-none`}
      style={liftAboveKeyboard(keyboardInset)}
    >
      <button
        onClick={onClose}
        className="text-ink-soft mx-auto mt-2 mb-1 flex items-center gap-1 rounded-full px-3 py-1 text-xs sm:hidden"
      >
        ▾ Close notes
      </button>
      {notice && (
        <div className="border-line flex items-start justify-between gap-2 border-b px-4 py-2">
          <p className="text-[11px] text-[#9B4E2E]">{notice}</p>
          <button
            onClick={onDismissNotice}
            aria-label="Dismiss"
            className="text-ink hover:text-accent shrink-0 text-xs"
          >
            ✕
          </button>
        </div>
      )}
      {composer}

      {annotations.length > 0 && (
        <KindFilterBar
          annotations={annotations}
          kindFilter={kindFilter}
          onChange={setKindFilter}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {annotations.length === 0 && !composer ? (
          <p className="text-ink-soft text-sm">
            Select any passage and say what it is — a key idea, a definition,
            an example, or a question. One tap marks it; the note is optional.
          </p>
        ) : shownNotes.length === 0 ? (
          <p className="text-ink-soft text-sm italic">
            {kindFilter
              ? `Nothing marked as ${KIND_META[kindFilter].label} yet.`
              : "No notes yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {shownNotes.map((annotation) => (
              <NoteListItem
                key={annotation.id}
                annotation={annotation}
                onJumpTo={onJumpTo}
                onEditNote={onEditNote}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

// position:fixed elements stay behind the iOS on-screen keyboard, so the sheet
// rides above it while a note is being typed.
function liftAboveKeyboard(keyboardInset: number) {
  if (keyboardInset <= 0) return undefined;
  return {
    transform: `translateY(-${keyboardInset}px)`,
    maxHeight: `calc(100dvh - ${keyboardInset}px - 4rem)`,
  };
}

function KindFilterBar({
  annotations,
  kindFilter,
  onChange,
}: {
  annotations: Annotation[];
  kindFilter: AnnotationKind | null;
  onChange: (kind: AnnotationKind | null) => void;
}) {
  return (
    <div className="border-line flex flex-wrap gap-1 border-b px-4 py-2">
      <button
        onClick={() => onChange(null)}
        className={`${FILTER_CHIP} ${
          kindFilter === null ? "bg-accent text-accent-ink" : IDLE_CHIP
        }`}
      >
        all {annotations.length}
      </button>
      {KIND_ORDER.map((kind) => {
        const count = annotations.filter((a) => a.kind === kind).length;
        return (
          <button
            key={kind}
            onClick={() => onChange(kindFilter === kind ? null : kind)}
            disabled={count === 0}
            className={`${FILTER_CHIP} disabled:opacity-40 ${
              kindFilter === kind
                ? `hl hl-${kind} text-ink ring-accent ring-1`
                : IDLE_CHIP
            }`}
          >
            {KIND_META[kind].glyph} {count}
          </button>
        );
      })}
    </div>
  );
}

function NoteListItem({
  annotation,
  onJumpTo,
  onEditNote,
  onDelete,
}: {
  annotation: Annotation;
  onJumpTo: (cfiRange: string) => void;
  onEditNote: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  const { cfiRange, kind, text, comment, mine, authorName } = annotation;
  return (
    <li className="group border-line bg-bg/40 rounded-lg border p-3">
      <button onClick={() => onJumpTo(cfiRange)} className="w-full text-left">
        <span
          className={`hl hl-${kind} text-ink mb-1.5 inline-block px-1.5 py-0.5 font-mono text-[10px]`}
        >
          {KIND_META[kind].glyph} {KIND_META[kind].label}
        </span>
        <p
          className={`text-ink-soft border-l-2 pl-2 text-sm ${
            mine ? "border-accent" : "border-blue-400"
          }`}
        >
          “{text}”
        </p>
        {comment && <p className="text-ink mt-2 text-sm">{comment}</p>}
      </button>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-ink-soft text-xs">{mine ? "You" : authorName}</span>
        {mine && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditNote(annotation)}
              className="text-ink hover:text-accent font-mono text-[11px]"
            >
              {comment ? "edit" : "note"}
            </button>
            <button
              onClick={() => onDelete(annotation)}
              aria-label="Delete note"
              title="Delete note"
              className="text-base transition-colors hover:text-red-500"
            >
              🗑
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
