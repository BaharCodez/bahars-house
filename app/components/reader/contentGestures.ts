import type { Contents, Rendition } from "epubjs";

export interface TextSelection {
  cfiRange: string;
  text: string;
}

interface GestureOptions {
  container: HTMLElement;
  scrolled: boolean;
  onSelectionChange: (selection: TextSelection | null) => void;
}

const SELECTION_SETTLE_MS = 350;
const EDGE_TOLERANCE_PX = 4;
const CHAPTER_SWIPE_MIN_PX = 90;
const PAGE_SWIPE_MIN_PX = 45;
const WHEEL_OVERSCROLL_THRESHOLD = 120;

type EdgeState = { atTop: boolean; atBottom: boolean };

// Wires every chapter document epub.js loads: selectable text, selection
// tracking, and swipe/wheel navigation.
export function registerContentGestures(
  rendition: Rendition,
  { container, scrolled, onSelectionChange }: GestureOptions,
) {
  rendition.hooks.content.register((contents: Contents) => {
    const doc = contents.document;
    forceSelectableText(doc);
    trackSelection(contents, onSelectionChange);

    const readEdges = edgeReader(container);
    if (scrolled) {
      attachChapterOverscrollSwipe(doc, rendition, readEdges);
      attachChapterOverscrollWheel(doc, rendition, readEdges);
    } else {
      attachPageSwipe(doc, rendition);
    }
  });
}

// Selection can be disabled by default on iOS in standalone/PWA mode.
function forceSelectableText(doc: Document) {
  for (const el of [doc.documentElement, doc.body]) {
    if (!el) continue;
    el.style.setProperty("-webkit-user-select", "text");
    el.style.setProperty("user-select", "text");
    el.style.setProperty("-webkit-touch-callout", "default");
  }
}

// epub.js's own "selected" relies on mouseup, which iOS doesn't fire;
// selectionchange is reliable everywhere. Only track the selection here —
// opening the composer (with its autofocused textarea) while the reader is
// still dragging the iOS selection handles pops the keyboard and collapses the
// selection, so that waits for a tap on the pill.
function trackSelection(
  contents: Contents,
  onSelectionChange: GestureOptions["onSelectionChange"],
) {
  const doc = contents.document;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  doc.addEventListener("selectionchange", () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const selection = doc.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!text || !selection || selection.rangeCount === 0) {
        onSelectionChange(null);
        return;
      }
      try {
        const cfiRange = contents.cfiFromRange(selection.getRangeAt(0));
        if (cfiRange) onSelectionChange({ cfiRange, text });
      } catch {
        /* couldn't resolve a CFI — ignore */
      }
    }, SELECTION_SETTLE_MS);
  });
}

// In scrolled-doc the chapter scrolls on epub.js's outer .epub-container — the
// iframe document itself NEVER scrolls, so edge checks must read from that
// element (touch and wheel alike).
function edgeReader(container: HTMLElement): () => EdgeState {
  const scroller =
    (container.querySelector(".epub-container") as HTMLElement) || container;
  return () => ({
      atTop: scroller.scrollTop <= EDGE_TOLERANCE_PX,
      atBottom:
        scroller.scrollTop + scroller.clientHeight >=
        scroller.scrollHeight - EDGE_TOLERANCE_PX,
  });
}

type SwipeDelta = { dx: number; dy: number };

// Reports each swipe's travel to onEnd, skipping touches that made a text
// selection.
function listenForSwipes(
  doc: Document,
  handlers: { onStart?: () => void; onEnd: (delta: SwipeDelta) => void },
) {
  let startX: number | null = null;
  let startY = 0;
  doc.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
      handlers.onStart?.();
    },
    { passive: true },
  );
  doc.addEventListener(
    "touchend",
    (e: TouchEvent) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null;
      if (doc.getSelection()?.toString()) return;
      handlers.onEnd({ dx, dy });
    },
    { passive: true },
  );
}

// Light passive swipe to turn pages (works on Android; doesn't fight iOS text
// selection — on iOS use the edge tap-zones to turn pages).
function attachPageSwipe(doc: Document, rendition: Rendition) {
  listenForSwipes(doc, {
    onEnd: ({ dx, dy }) => {
      const isHorizontal =
        Math.abs(dx) > PAGE_SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5;
      if (!isHorizontal) return;
      if (dx < 0) rendition.next();
      else rendition.prev();
    },
  });
}

// Over-scroll past a chapter edge to change chapters: a firm upward swipe at
// the bottom → next, downward at top → prev.
function attachChapterOverscrollSwipe(
  doc: Document,
  rendition: Rendition,
  readEdges: () => EdgeState,
) {
  // Only an over-scroll that BEGAN at a chapter edge may change chapters — a
  // flick that merely lands at the edge shouldn't.
  let edgesAtStart: EdgeState = { atTop: false, atBottom: false };
  listenForSwipes(doc, {
    onStart: () => {
      edgesAtStart = readEdges();
    },
    onEnd: ({ dx, dy }) => {
      const { atTop, atBottom } = readEdges();
      const isFirmVertical =
        Math.abs(dy) > CHAPTER_SWIPE_MIN_PX && Math.abs(dy) > Math.abs(dx);
      if (!isFirmVertical) return;
      if (dy < 0 && atBottom && edgesAtStart.atBottom) rendition.next();
      else if (dy > 0 && atTop && edgesAtStart.atTop) rendition.prev();
    },
  });
}

// Desktop (laptop): there's no touch swipe, so changing chapters in scroll
// mode relies on the wheel/trackpad — the wheel event still fires inside the
// iframe doc. Once at an edge, accumulate wheel delta in the same direction
// and cross a threshold to flip to the next/prev chapter.
function attachChapterOverscrollWheel(
  doc: Document,
  rendition: Rendition,
  readEdges: () => EdgeState,
) {
  let overscroll = 0;
  let lastDirection = 0;
  let navigating = false;
  doc.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      if (navigating) return;
      const { atTop, atBottom } = readEdges();
      const direction = e.deltaY > 0 ? 1 : -1;
      const atEdge = (direction > 0 && atBottom) || (direction < 0 && atTop);
      if (!atEdge) {
        overscroll = 0;
        return;
      }
      if (direction !== lastDirection) {
        overscroll = 0;
        lastDirection = direction;
      }
      overscroll += Math.abs(e.deltaY);
      if (overscroll <= WHEEL_OVERSCROLL_THRESHOLD) return;
      navigating = true;
      overscroll = 0;
      if (direction > 0) rendition.next();
      else rendition.prev();
    },
    { passive: true },
  );
}
