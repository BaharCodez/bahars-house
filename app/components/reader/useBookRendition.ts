import { useCallback, useEffect, useRef, useState } from "react";
import type { Book, Rendition } from "epubjs";
import { bookFileUrl, fetchProgress, saveProgress } from "@/app/lib/api";
import { closeSelfClosedRawTextTags } from "./repairMarkup";
import { registerContentGestures, type TextSelection } from "./contentGestures";
import { useRoadmapTracking } from "./roadmapTracking";
import {
  currentCfi,
  readingProgressAt,
  type ReadingProgress,
} from "./renditionLocation";
import { flattenToc, type TocEntry } from "./toc";

export type ReadingMode = "paginated" | "scrolled";

interface BookRenditionOptions {
  bookId: string;
  mode: ReadingMode;
  // An EPUB href to open at instead of the saved position.
  initialLoc?: string;
  fontScale: number;
  onSelectionChange: (selection: TextSelection | null) => void;
}

const SAVE_PROGRESS_DELAY_MS = 1200;
const CHARS_PER_LOCATION = 1000;

// Opens the book into the viewer once per book and reading mode, and exposes
// what the reader UI needs: load state, title, contents, progress and
// navigation.
export function useBookRendition({
  bookId,
  mode,
  initialLoc,
  fontScale,
  onSelectionChange,
}: BookRenditionOptions) {
  // Captured once: a step link's target section only applies to this open.
  const initialLocRef = useRef(initialLoc);
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  // Held in a ref so the setup effect can apply the current size without
  // re-running on every change.
  const fontScaleRef = useRef(fontScale);
  const { recordPosition, startTracking, flushPending } =
    useRoadmapTracking(bookId);

  const [title, setTitle] = useState("Reading…");
  const [ready, setReady] = useState(false);
  // Fatal: the book itself wouldn't open.
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);

  useEffect(() => {
    fontScaleRef.current = fontScale;
    renditionRef.current?.themes.fontSize(`${fontScale}%`);
  }, [fontScale]);

  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;

    let destroyed = false;
    let detachOrientation: (() => void) | null = null;
    const isCancelled = () => destroyed;
    let openedBook: Book | null = null;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    // A selection can't survive a rendition rebuild.
    onSelectionChange(null);

    const showProgressAt = (book: Book, cfi: string) => {
      const next = readingProgressAt(book, cfi);
      if (next) setProgress(next);
    };

    const open = async () => {
      const bytes = await fetchBookBytes(bookId);
      if (destroyed) return;
      const epubModule = await import("epubjs");
      if (destroyed) return;

      const book = epubModule.default(bytes);
      openedBook = book;
      bookRef.current = book;
      await book.ready;
      if (destroyed) return;
      closeSelfClosedRawTextTags(book);

      const scrolled = mode === "scrolled";
      const rendition = renderBook(book, container, scrolled);
      renditionRef.current = rendition;
      if (!scrolled) detachOrientation = followOrientation(rendition);
      turnPagesWithArrowKeys(rendition);
      registerContentGestures(rendition, {
        container,
        scrolled,
        onSelectionChange,
      });

      // Remember the reading position per user (synced via the server).
      // Debounce the save so page turns don't hammer the API.
      rendition.on("relocated", (location: { start: { cfi: string } }) => {
        const cfi = location.start.cfi;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(
          () => saveProgress(bookId, cfi),
          SAVE_PROGRESS_DELAY_MS,
        );
        recordPosition(cfi);
        showProgressAt(book, cfi);
      });

      // Desktop mouseup selection — feeds the same pill as selectionchange.
      rendition.on("selected", (cfiRange: string) => {
        book
          .getRange(cfiRange)
          .then((range) => {
            const text = range?.toString().trim() ?? "";
            if (text) onSelectionChange({ cfiRange, text });
          })
          .catch(() => {});
      });

      // Resume where this user left off (synced across their devices).
      const savedCfi = await fetchProgress(bookId).catch(() => null);
      if (destroyed) return;
      await displayStart(rendition, initialLocRef.current, savedCfi);
      if (destroyed) return;

      rendition.themes.fontSize(`${fontScaleRef.current}%`);

      book.loaded.metadata
        .then((meta) => {
          if (!destroyed && meta?.title) setTitle(meta.title);
        })
        .catch(() => {});

      book.loaded.navigation
        .then((nav) => {
          if (!destroyed) setToc(flattenToc(nav.toc));
        })
        .catch(() => {});

      setReady(true);

      startTracking({
        book,
        EpubCFI: epubModule.EpubCFI,
        rendition,
        openedViaStepLink: Boolean(initialLocRef.current),
        isCancelled,
      });

      book.locations
        .generate(CHARS_PER_LOCATION)
        .then(() => {
          if (destroyed) return;
          const cfi = currentCfi(rendition);
          if (cfi) showProgressAt(book, cfi);
        })
        .catch(() => {});
    };

    open().catch((e) => {
      if (destroyed) return;
      setError("Couldn't open this book.");
      console.error(e);
    });

    return () => {
      destroyed = true;
      if (saveTimer) clearTimeout(saveTimer);
      flushPending();
      detachOrientation?.();
      openedBook?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [
    bookId,
    mode,
    onSelectionChange,
    recordPosition,
    startTracking,
    flushPending,
  ]);

  const prev = useCallback(() => renditionRef.current?.prev(), []);
  const next = useCallback(() => renditionRef.current?.next(), []);

  function display(target: string) {
    renditionRef.current?.display(target);
  }

  function goToPage(page: number) {
    const cfi = bookRef.current?.locations.cfiFromLocation(page - 1);
    if (cfi) renditionRef.current?.display(cfi);
  }

  return {
    viewerRef,
    renditionRef,
    ready,
    error,
    title,
    toc,
    progress,
    prev,
    next,
    display,
    goToPage,
  };
}

async function fetchBookBytes(bookId: string): Promise<ArrayBuffer> {
  const res = await fetch(bookFileUrl(bookId));
  if (!res.ok) throw new Error(`Book load failed (${res.status})`);
  return res.arrayBuffer();
}

function renderBook(book: Book, container: HTMLElement, scrolled: boolean) {
  return book.renderTo(container, {
    width: "100%",
    height: "100%",
    // scrolled-doc = one chapter scrolls on its own (no continuous
    // prepend/append, so it doesn't jump at chapter seams).
    flow: scrolled ? "scrolled-doc" : "paginated",
    manager: "default",
    spread: "auto",
  });
}

// One column in portrait, two-page spread in landscape. Returns the detach.
function followOrientation(rendition: Rendition): () => void {
  const portrait = window.matchMedia("(orientation: portrait)");
  const applySpread = () =>
    rendition.spread(portrait.matches ? "none" : "auto");
  applySpread();
  portrait.addEventListener("change", applySpread);
  return () => portrait.removeEventListener("change", applySpread);
}

function turnPagesWithArrowKeys(rendition: Rendition) {
  rendition.on("keyup", (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") rendition.prev();
    if (e.key === "ArrowRight") rendition.next();
  });
}

// A roadmap step jump (initialLoc) wins over the saved position — but a
// bad/unresolvable section must never blank out the whole book, so fall back
// to the saved position (or the start) if the jump fails.
async function displayStart(
  rendition: Rendition,
  initialLoc: string | undefined,
  savedCfi: string | null,
) {
  try {
    await rendition.display(initialLoc ?? savedCfi ?? undefined);
  } catch {
    if (initialLoc) {
      await rendition.display(savedCfi ?? undefined).catch(() => {});
    }
  }
}
