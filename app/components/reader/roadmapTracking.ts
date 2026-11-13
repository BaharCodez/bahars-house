import { useCallback, useRef } from "react";
import type { Book, EpubCFI, Rendition } from "epubjs";
import {
  fetchRoadmapStepsForBook,
  markRoadmapStepsRead,
  type RoadmapReadingStep,
} from "@/app/lib/api";
import { currentCfi } from "./renditionLocation";

// A roadmap step linked to a section of this book, resolved to the CFI where
// that section begins — so reading past it can tick the step off.
type TrackedStep = { id: string; cfi: string };

type EpubCFIConstructor = new () => EpubCFI;

const WRITE_BACK_DELAY_MS = 1500;

interface StartTrackingOptions {
  book: Book;
  EpubCFI: EpubCFIConstructor;
  rendition: Rendition;
  // Translates step links into the (possibly merged) book's hrefs.
  remapHref: (href: string) => string;
  openedViaStepLink: boolean;
  isCancelled: () => boolean;
}

// Reading past a linked section ticks its roadmap step. Progress only grows
// (never unticks on a scroll back), and writes are debounced and batched.
// A no-op until startTracking has resolved the steps, and for visitors (the
// API hands them no steps).
export function useRoadmapTracking(bookId: string) {
  // Linked sections, sorted by reading order.
  const stepsRef = useRef<TrackedStep[]>([]);
  // Ids already ticked, so we never re-send.
  const doneIdsRef = useRef<Set<string>>(new Set());
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The previous reading position, so we tick a section only when you actually
  // cross it — jumping to a later chapter must not claim the earlier ones.
  const lastCfiRef = useRef<string | null>(null);
  const comparerRef = useRef<EpubCFI | null>(null);

  const scheduleWriteBack = useCallback(() => {
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      const ids = [...pendingIdsRef.current];
      pendingIdsRef.current.clear();
      markRoadmapStepsRead(bookId, ids);
    }, WRITE_BACK_DELAY_MS);
  }, [bookId]);

  // Ticks every untouched step whose section was crossed moving from `from`
  // to `to`. A null `from` counts every section up to `to` as crossed.
  const tickCrossedSteps = useCallback(
    (from: string | null, to: string) => {
      const steps = stepsRef.current;
      const comparer = comparerRef.current;
      if (!steps.length || !comparer) return;
      const compare = (a: string, b: string) => {
        try {
          return comparer.compare(a, b);
        } catch {
          return NaN;
        }
      };
      let ticked = false;
      steps.forEach((step, i) => {
        if (doneIdsRef.current.has(step.id)) return;
        // Counts as read once you reach the next section (or, for the last
        // one, the section itself).
        const threshold = steps[i + 1]?.cfi ?? step.cfi;
        const reached = compare(to, threshold) >= 0;
        const crossed = from === null || compare(from, threshold) < 0;
        if (!reached || !crossed) return;
        doneIdsRef.current.add(step.id);
        pendingIdsRef.current.add(step.id);
        ticked = true;
      });
      lastCfiRef.current = to;
      if (ticked) scheduleWriteBack();
    },
    [scheduleWriteBack],
  );

  const recordPosition = useCallback(
    (cfi: string) => tickCrossedSteps(lastCfiRef.current, cfi),
    [tickCrossedSteps],
  );

  // Owner-only: resolve each linked section to a CFI in the background, then
  // reconcile against wherever we opened (so already-read sections tick
  // immediately). Best-effort — never break the reader over it.
  const startTracking = useCallback(
    async ({
      book,
      EpubCFI,
      rendition,
      remapHref,
      openedViaStepLink,
      isCancelled,
    }: StartTrackingOptions) => {
      try {
        const steps = await fetchRoadmapStepsForBook(bookId);
        if (isCancelled() || !steps.length) return;
        comparerRef.current = new EpubCFI();
        const tracked = await resolveTrackedSteps(
          book,
          EpubCFI,
          steps.map((s) => ({ ...s, loc: remapHref(s.loc) })),
        );
        if (isCancelled()) return;
        stepsRef.current = tracked;
        doneIdsRef.current = new Set(
          steps.filter((s) => s.done).map((s) => s.id),
        );
        const cfi = currentCfi(rendition);
        if (!cfi) return;
        // Jumped in via a step link → start fresh; only tick as you go.
        // Resumed at a saved spot → everything up to here was read.
        if (openedViaStepLink) lastCfiRef.current = cfi;
        else tickCrossedSteps(null, cfi);
      } catch {
        /* tracking is best-effort */
      }
    },
    [bookId, tickCrossedSteps],
  );

  // Sends any sections ticked in the last moment before closing.
  const flushPending = useCallback(() => {
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    const pending = pendingIdsRef.current;
    if (!pending.size) return;
    markRoadmapStepsRead(bookId, [...pending]);
    pending.clear();
  }, [bookId]);

  return { recordPosition, startTracking, flushPending };
}

// Resolve each linked step's EPUB href (e.g. "ch03.html#sec_storage") to a
// CFI. Loads each chapter file once, finds the anchored element, and asks
// epub.js for its CFI. Best-effort: anything that won't resolve is skipped.
// Returns the steps sorted by reading order.
async function resolveTrackedSteps(
  book: Book,
  EpubCFI: EpubCFIConstructor,
  steps: Pick<RoadmapReadingStep, "id" | "loc">[],
): Promise<TrackedStep[]> {
  const resolved: TrackedStep[] = [];
  for (const [href, anchors] of groupAnchorsByHref(steps)) {
    try {
      resolved.push(...(await resolveSectionAnchors(book, href, anchors)));
    } catch {
      /* skip a chapter we can't load */
    }
  }

  const comparer = new EpubCFI();
  return resolved.sort((a, b) => {
    try {
      return comparer.compare(a.cfi, b.cfi);
    } catch {
      return 0;
    }
  });
}

type StepAnchor = { id: string; anchor: string | null };

function groupAnchorsByHref(steps: { id: string; loc: string }[]) {
  const byHref = new Map<string, StepAnchor[]>();
  for (const step of steps) {
    const [href, anchor] = step.loc.split("#");
    const anchors = byHref.get(href) ?? [];
    anchors.push({ id: step.id, anchor: anchor ?? null });
    byHref.set(href, anchors);
  }
  return byHref;
}

async function resolveSectionAnchors(
  book: Book,
  href: string,
  anchors: StepAnchor[],
): Promise<TrackedStep[]> {
  const section = book.spine.get(href);
  if (!section) return [];
  await section.load(book.load.bind(book));
  const doc = section.document;
  const resolved: TrackedStep[] = [];
  for (const { id, anchor } of anchors) {
    try {
      const el = anchor ? doc.getElementById(anchor) : doc.body;
      const cfi = el ? section.cfiFromElement(el) : null;
      if (cfi) resolved.push({ id, cfi });
    } catch {
      /* one bad anchor shouldn't sink the rest */
    }
  }
  section.unload();
  return resolved;
}
