"use client";

import { useEffect, useState } from "react";
import {
  createAnnotation,
  deleteAnnotation,
  patchAnnotation,
} from "@/app/lib/api";
import type { Annotation, AnnotationKind } from "@/app/lib/types";
import type { TextSelection } from "./reader/contentGestures";
import { useBookRendition } from "./reader/useBookRendition";
import { useReaderPreferences } from "./reader/useReaderPreferences";
import { useKeyboardInset } from "./reader/useKeyboardInset";
import { useAnnotations } from "./reader/useAnnotations";
import { useHighlights } from "./reader/useHighlights";
import ReaderHeader from "./reader/ReaderHeader";
import ChaptersDrawer from "./reader/ChaptersDrawer";
import PageTurnZones from "./reader/PageTurnZones";
import SelectionKindPicker from "./reader/SelectionKindPicker";
import HighlightCard from "./reader/HighlightCard";
import NotesPanel from "./reader/NotesPanel";
import NoteComposer from "./reader/NoteComposer";
import ProgressFooter from "./reader/ProgressFooter";

export { KIND_META, KIND_ORDER } from "./reader/kinds";

interface ReaderProps {
  bookId: string;
  // An EPUB href (e.g. "ch01.html#sec_…") to open at, instead of the saved
  // position — used by roadmap step links that jump to a specific section.
  initialLoc?: string;
  onClose: () => void;
}

export default function Reader({ bookId, initialLoc, onClose }: ReaderProps) {
  const { mode, toggleMode, fontScale, changeFontScale } =
    useReaderPreferences();
  const keyboardInset = useKeyboardInset();
  // The current text selection, before it's been categorised. Shown as a row
  // of one-tap kind buttons — buttons, not a text composer, so the keyboard
  // never opens mid-selection (on iOS that collapses the selection).
  const [candidate, setCandidate] = useState<TextSelection | null>(null);
  // Refs split out so reading `book.*` during render isn't a ref access.
  const { viewerRef, renditionRef, ...book } = useBookRendition({
    bookId,
    mode,
    initialLoc,
    fontScale,
    onSelectionChange: setCandidate,
  });
  const [annotations, setAnnotations] = useAnnotations(bookId, book.ready);
  // The note shown when you tap a highlight in the book.
  const [activeNote, setActiveNote] = useState<Annotation | null>(null);
  useHighlights({
    renditionRef,
    ready: book.ready,
    annotations,
    onTap: setActiveNote,
  });

  // Transient: a write didn't land. Shown in the notes panel and dismissible,
  // because the book is still perfectly readable — unlike book.error.
  const [notice, setNotice] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<Annotation | null>(null);
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);

  const { prev, next } = book;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  function reportFailedWrite(message: string, error: unknown) {
    console.error(error);
    setNotice(message);
    setPanelOpen(true);
  }

  function goToChapter(href: string) {
    book.display(href);
    setChaptersOpen(false);
  }

  function composeNote(annotation: Annotation, initialDraft: string) {
    setNoteFor(annotation);
    setDraft(initialDraft);
  }

  function closeComposer() {
    setNoteFor(null);
    setDraft("");
  }

  // Categorising *is* saving: one tap turns the selection into a mark. The
  // note box then opens for that mark, but writing one is optional — you can
  // ignore it and read on.
  async function markSelection(kind: AnnotationKind) {
    if (!candidate) return;
    const selection = candidate;
    setCandidate(null);
    try {
      const created = await createAnnotation(bookId, {
        cfiRange: selection.cfiRange,
        text: selection.text,
        comment: "",
        kind,
      });
      setNotice(null);
      setAnnotations((prev) => [...prev, created]);
      composeNote(created, "");
      setPanelOpen(true);
    } catch (e) {
      reportFailedWrite("Couldn't save that mark — check your connection.", e);
    }
  }

  async function saveNote() {
    if (!noteFor) return;
    const target = noteFor;
    const comment = draft.trim();
    closeComposer();
    if (comment === target.comment) return;
    try {
      const updated = await patchAnnotation(target.id, { comment });
      setAnnotations((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
    } catch (e) {
      reportFailedWrite("Couldn't save your note — check your connection.", e);
    }
  }

  async function recategorise(annotation: Annotation, kind: AnnotationKind) {
    if (annotation.kind === kind) return;
    const withKind = (a: Annotation) =>
      a.id === annotation.id ? { ...a, kind } : a;
    setAnnotations((prev) => prev.map(withKind));
    setActiveNote((shown) => shown && withKind(shown));
    try {
      await patchAnnotation(annotation.id, { kind });
    } catch (e) {
      reportFailedWrite(
        "Couldn't change that mark — check your connection.",
        e,
      );
    }
  }

  async function removeAnnotation(annotation: Annotation) {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
    try {
      await deleteAnnotation(annotation.id);
    } catch (e) {
      console.error(e);
    }
  }

  function editActiveNote(annotation: Annotation) {
    composeNote(annotation, annotation.comment);
    setActiveNote(null);
    setPanelOpen(true);
  }

  return (
    <div className="bg-bg flex h-screen flex-col">
      <ReaderHeader
        title={book.title}
        hasChapters={book.toc.length > 0}
        mode={mode}
        noteCount={annotations.length}
        onClose={onClose}
        onToggleChapters={() => setChaptersOpen((open) => !open)}
        onChangeFontScale={changeFontScale}
        onToggleMode={toggleMode}
        onToggleNotes={() => setPanelOpen((open) => !open)}
      />

      {chaptersOpen && (
        <button
          aria-label="Close chapters"
          onClick={() => setChaptersOpen(false)}
          className="bg-ink/20 fixed inset-0 z-30 md:hidden"
        />
      )}
      <div className="flex min-h-0 flex-1">
        <ChaptersDrawer
          open={chaptersOpen}
          toc={book.toc}
          onSelect={goToChapter}
          onClose={() => setChaptersOpen(false)}
        />

        <div className="relative flex min-w-0 flex-1 items-stretch">
          <div className="relative min-w-0 flex-1">
            <div ref={viewerRef} className="h-full w-full" />
            {/* Scroll mode navigates by scrolling + over-scroll at chapter
                ends instead. */}
            {mode === "paginated" && (
              <PageTurnZones onPrev={prev} onNext={next} />
            )}
            {!book.ready && !book.error && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                Opening book…
              </p>
            )}
            {book.error && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-red-600 dark:text-red-400">
                {book.error}
              </p>
            )}
            {candidate && (
              <SelectionKindPicker
                onPick={markSelection}
                onDismiss={() => setCandidate(null)}
              />
            )}
            {activeNote && (
              <HighlightCard
                annotation={activeNote}
                onRecategorise={(kind) => recategorise(activeNote, kind)}
                onEditNote={() => editActiveNote(activeNote)}
                onClose={() => setActiveNote(null)}
              />
            )}
          </div>
        </div>

        <NotesPanel
          open={panelOpen}
          keyboardInset={keyboardInset}
          annotations={annotations}
          notice={notice}
          composer={
            noteFor && (
              <NoteComposer
                annotation={noteFor}
                draft={draft}
                onDraftChange={setDraft}
                onSkip={closeComposer}
                onSave={saveNote}
              />
            )
          }
          onDismissNotice={() => setNotice(null)}
          onClose={() => setPanelOpen(false)}
          onJumpTo={book.display}
          onEditNote={(annotation) =>
            composeNote(annotation, annotation.comment)
          }
          onDelete={removeAnnotation}
        />
      </div>

      {book.progress && (
        <ProgressFooter progress={book.progress} onGoToPage={book.goToPage} />
      )}
    </div>
  );
}
