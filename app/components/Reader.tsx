"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Book, Rendition } from "epubjs";
import {
  bookFileUrl,
  createAnnotation,
  deleteAnnotation,
  fetchAnnotations,
  fetchProgress,
  fetchRoadmapStepsForBook,
  markRoadmapStepsRead,
  saveProgress,
} from "@/app/lib/api";
import type { Annotation } from "@/app/lib/types";
import ThemePicker from "./ThemePicker";
import AmbientMusic from "./AmbientMusic";

interface ReaderProps {
  bookId: string;
  // An EPUB href (e.g. "ch01.html#sec_…") to open at, instead of the saved
  // position — used by roadmap step links that jump to a specific section.
  initialLoc?: string;
  onClose: () => void;
}

// A passage the reader just selected but hasn't commented on yet.
interface PendingSelection {
  cfiRange: string;
  text: string;
}

// How often we poll for notes other readers have added.
const POLL_MS = 5000;

const MINE_STYLE = { fill: "#fbbf24", "fill-opacity": "0.35" };
const OTHERS_STYLE = { fill: "#60a5fa", "fill-opacity": "0.30" };

// Flatten the (possibly nested) EPUB table of contents into a list with depth.
interface NavItem {
  label?: string;
  href: string;
  subitems?: NavItem[];
}
function flattenToc(
  items: NavItem[],
  depth = 0,
  out: { label: string; href: string; depth: number }[] = [],
) {
  for (const it of items) {
    out.push({ label: (it.label ?? "").trim(), href: it.href, depth });
    if (it.subitems?.length) flattenToc(it.subitems, depth + 1, out);
  }
  return out;
}

// A roadmap step linked to a section of this book, resolved to the CFI where
// that section begins — so reading past it can tick the step off.
type TrackedStep = { id: string; cfi: string };

// Resolve each linked step's EPUB href (e.g. "ch03.html#sec_storage") to a
// CFI. Loads each chapter file once, finds the anchored element, and asks
// epub.js for its CFI. Best-effort: anything that won't resolve is skipped.
// Returns the steps sorted by reading order.
async function resolveTrackedSteps(
  book: Book,
  EpubCFICtor: new () => { compare: (a: string, b: string) => number },
  steps: { id: string; loc: string }[],
): Promise<TrackedStep[]> {
  const byHref = new Map<string, { id: string; anchor: string | null }[]>();
  for (const s of steps) {
    const [href, anchor] = s.loc.split("#");
    if (!byHref.has(href)) byHref.set(href, []);
    byHref.get(href)!.push({ id: s.id, anchor: anchor ?? null });
  }

  const resolved: TrackedStep[] = [];
  for (const [href, items] of byHref) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const section: any = book.spine.get(href);
      if (!section) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await section.load((book as any).load.bind(book));
      const doc: Document = section.document;
      for (const it of items) {
        try {
          const el = it.anchor ? doc.getElementById(it.anchor) : doc.body;
          const cfi = el ? section.cfiFromElement(el) : null;
          if (cfi) resolved.push({ id: it.id, cfi });
        } catch {
          /* one bad anchor shouldn't sink the rest */
        }
      }
      section.unload();
    } catch {
      /* skip a chapter we can't load */
    }
  }

  const cmp = new EpubCFICtor();
  resolved.sort((a, b) => {
    try {
      return cmp.compare(a.cfi, b.cfi);
    } catch {
      return 0;
    }
  });
  return resolved;
}

function addHighlight(
  rendition: Rendition,
  cfiRange: string,
  mine: boolean,
  onClick: () => void,
) {
  rendition.annotations.add(
    "highlight",
    cfiRange,
    {},
    onClick,
    "sr-highlight",
    mine ? MINE_STYLE : OTHERS_STYLE,
  );
}

export default function Reader({ bookId, initialLoc, onClose }: ReaderProps) {
  // Captured once: a step link's target section only applies to this open.
  const initialLocRef = useRef(initialLoc);
  // Roadmap auto-tracking: linked sections (sorted by reading order), the ids
  // already ticked (so we never re-send), and a debounce for the write-back.
  const trackedRef = useRef<TrackedStep[]>([]);
  const trackedDoneRef = useRef<Set<string>>(new Set());
  const trackPendingRef = useRef<Set<string>>(new Set());
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The previous reading position, so we tick a section only when you actually
  // cross it — jumping to a later chapter must not claim the earlier ones.
  const lastCfiRef = useRef<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epubCfiRef = useRef<any>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  // Annotation ids whose highlights are currently drawn, so we only add/remove
  // the delta when the list changes (own saves or friends' notes via polling).
  const drawnRef = useRef<Map<string, string>>(new Map());

  const [title, setTitle] = useState("Reading…");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  // The current text selection, before the reader commits to writing a note.
  // Shown as a floating "Add note" pill so we never open the composer (and
  // the keyboard) mid-selection — on iOS that collapses the selection.
  const [candidate, setCandidate] = useState<PendingSelection | null>(null);
  const [draft, setDraft] = useState("");
  // The note shown when you tap a highlight in the book.
  const [activeNote, setActiveNote] = useState<Annotation | null>(null);
  const [copied, setCopied] = useState(false);
  // On mobile the notes panel is a bottom sheet toggled open; on desktop it's
  // always the side column.
  const [panelOpen, setPanelOpen] = useState(false);
  // Table of contents (flattened, with depth) + its drawer toggle.
  const [toc, setToc] = useState<
    { label: string; href: string; depth: number }[]
  >([]);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  // Reading progress (page X of Y), derived from epub.js locations.
  const [progress, setProgress] = useState<{
    cur: number;
    total: number;
  } | null>(null);
  // "paginated" = flip pages; "scrolled" = continuous vertical scroll.
  const [mode, setMode] = useState<"paginated" | "scrolled">("paginated");
  // Height of the on-screen keyboard (iOS): the notes bottom sheet is
  // position:fixed, which iOS keeps behind the keyboard, so we lift it by
  // this much while typing a note.
  const [kbInset, setKbInset] = useState(0);
  // Reader font size as a percentage; held in a ref too so the setup effect
  // can apply the saved size without re-running on every change.
  const [fontScale, setFontScale] = useState(100);
  const fontScaleRef = useRef(100);

  // Restore the saved reading mode (deferred so it doesn't run synchronously).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (localStorage.getItem("readingMode") === "scrolled")
        setMode("scrolled");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function toggleMode() {
    setMode((m) => {
      const next = m === "paginated" ? "scrolled" : "paginated";
      localStorage.setItem("readingMode", next);
      return next;
    });
  }

  // Restore the saved font size (deferred so it doesn't run synchronously).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const saved = Number(localStorage.getItem("fontScale"));
      if (saved >= 70 && saved <= 220) setFontScale(saved);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Apply font size live and keep the ref in sync for the setup effect.
  useEffect(() => {
    fontScaleRef.current = fontScale;
    renditionRef.current?.themes.fontSize(`${fontScale}%`);
  }, [fontScale]);

  // Track the on-screen keyboard via the visual viewport. `height * scale`
  // (not raw height) so pinch-zoom doesn't read as a keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = window.innerHeight - vv.height * vv.scale - vv.offsetTop;
      setKbInset(Math.max(0, Math.round(inset)));
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  function changeFont(delta: number) {
    setFontScale((s) => {
      const next = Math.min(220, Math.max(70, s + delta));
      localStorage.setItem("fontScale", String(next));
      return next;
    });
  }

  // Set up the book + rendition once per book.
  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;

    let destroyed = false;
    let localBook: Book | null = null;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let detachOrientation: (() => void) | null = null;
    const drawn = drawnRef.current;
    // Stable across this open — captured for the cleanup flush below.
    const trackPending = trackPendingRef.current;
    setCandidate(null); // a selection can't survive a rendition rebuild

    (async () => {
      try {
        const res = await fetch(bookFileUrl(bookId));
        if (!res.ok) throw new Error(`Book load failed (${res.status})`);
        const data = await res.arrayBuffer();
        if (destroyed) return;

        const epubMod = await import("epubjs");
        const ePub = epubMod.default;
        if (destroyed) return;

        const book = ePub(data);
        localBook = book;
        bookRef.current = book;
        await book.ready;
        if (destroyed) return;

        // Some EPUBs ship XHTML content under a `.html` extension with
        // self-closing raw-text tags (e.g. `<script src=".."/>`). That's valid
        // XHTML, but epub.js parses `.html` sections as text/html, where a
        // self-closed <script> is treated as *unclosed* and swallows the rest
        // of the document as script text — so every chapter renders blank
        // (only the cover, which has no such tag, shows). A Kiss Before Dying
        // is one such book. Repair the raw markup just before epub.js parses
        // it by wrapping the archive's response handler: close self-closing
        // script/style/title/textarea tags (harmless on already-valid books).
        const archive = (
          book as unknown as {
            archive?: {
              handleResponse: (response: unknown, type?: string) => unknown;
            };
          }
        ).archive;
        if (archive && typeof archive.handleResponse === "function") {
          const original = archive.handleResponse.bind(archive);
          archive.handleResponse = (response: unknown, type?: string) => {
            if (
              typeof response === "string" &&
              (type === "html" || type === "htm" || type === "xhtml")
            ) {
              response = response.replace(
                /<(script|style|title|textarea)(\b[^>]*?)\/>/gi,
                "<$1$2></$1>",
              );
            }
            return original(response, type);
          };
        }

        const scrolled = mode === "scrolled";
        const rendition = book.renderTo(container, {
          width: "100%",
          height: "100%",
          // scrolled-doc = one chapter scrolls on its own (no continuous
          // prepend/append, so it doesn't jump at chapter seams).
          flow: scrolled ? "scrolled-doc" : "paginated",
          manager: "default",
          spread: "auto",
        });
        renditionRef.current = rendition;

        // One column in portrait, two-page spread in landscape (paginated only).
        if (!scrolled) {
          const portrait = window.matchMedia("(orientation: portrait)");
          const applySpread = () =>
            rendition.spread(portrait.matches ? "none" : "auto");
          applySpread();
          portrait.addEventListener("change", applySpread);
          detachOrientation = () =>
            portrait.removeEventListener("change", applySpread);
        }

        rendition.on("keyup", (e: KeyboardEvent) => {
          if (e.key === "ArrowLeft") rendition.prev();
          if (e.key === "ArrowRight") rendition.next();
        });

        // Light passive swipe to turn pages (works on Android; doesn't fight
        // iOS text selection — on iOS use the edge tap-zones to turn pages).
        rendition.hooks.content.register(
          (contents: {
            document: Document;
            cfiFromRange: (r: Range, ignore?: string) => string;
          }) => {
            const doc = contents.document;

            // Force the book text to be selectable on iOS (selection can be
            // disabled by default in standalone/PWA mode).
            for (const el of [doc.documentElement, doc.body]) {
              if (!el) continue;
              el.style.setProperty("-webkit-user-select", "text");
              el.style.setProperty("user-select", "text");
              el.style.setProperty("-webkit-touch-callout", "default");
            }

            // Selection → "Add note" pill. epub.js's own "selected" relies on
            // mouseup, which iOS doesn't fire; selectionchange is reliable
            // everywhere. Only track the selection here — opening the composer
            // (with its autofocused textarea) while the reader is still
            // dragging the iOS selection handles pops the keyboard and
            // collapses the selection, so that waits for a tap on the pill.
            let selTimer: ReturnType<typeof setTimeout> | null = null;
            doc.addEventListener("selectionchange", () => {
              if (selTimer) clearTimeout(selTimer);
              selTimer = setTimeout(() => {
                const sel = doc.getSelection();
                const text = sel?.toString().trim() ?? "";
                if (!text || !sel || sel.rangeCount === 0) {
                  setCandidate(null); // selection cleared — hide the pill
                  return;
                }
                try {
                  const cfi = contents.cfiFromRange(sel.getRangeAt(0));
                  if (cfi) setCandidate({ cfiRange: cfi, text });
                } catch {
                  /* couldn't resolve a CFI — ignore */
                }
              }, 350);
            });

            // In scrolled-doc the chapter scrolls on epub.js's outer
            // .epub-container — the iframe document itself NEVER scrolls, so
            // edge checks must read from that element (touch and wheel alike).
            const scroller =
              (container.querySelector(".epub-container") as HTMLElement) ||
              container;
            const atEdges = () => ({
              atTop: scroller.scrollTop <= 4,
              atBottom:
                scroller.scrollTop + scroller.clientHeight >=
                scroller.scrollHeight - 4,
            });

            let startX: number | null = null;
            let startY = 0;
            let startAtTop = false;
            let startAtBottom = false;
            doc.addEventListener(
              "touchstart",
              (e: TouchEvent) => {
                startX = e.changedTouches[0].clientX;
                startY = e.changedTouches[0].clientY;
                // Only an over-scroll that BEGAN at a chapter edge may change
                // chapters — a flick that merely lands at the edge shouldn't.
                ({ atTop: startAtTop, atBottom: startAtBottom } = atEdges());
              },
              { passive: true },
            );
            doc.addEventListener(
              "touchend",
              (e: TouchEvent) => {
                if (startX === null) {
                  startX = null;
                  return;
                }
                const dx = e.changedTouches[0].clientX - startX;
                const dy = e.changedTouches[0].clientY - startY;
                startX = null;
                if (doc.getSelection()?.toString()) return; // mid-selection

                if (scrolled) {
                  // Over-scroll past a chapter edge to change chapters: a firm
                  // upward swipe at the bottom → next, downward at top → prev.
                  const { atTop, atBottom } = atEdges();
                  if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) {
                    if (dy < 0 && atBottom && startAtBottom) rendition.next();
                    else if (dy > 0 && atTop && startAtTop) rendition.prev();
                  }
                  return;
                }

                // Paginated: horizontal swipe turns the page.
                if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                  if (dx < 0) rendition.next();
                  else rendition.prev();
                }
              },
              { passive: true },
            );

            // Desktop (laptop): there's no touch swipe, so changing chapters
            // in scroll mode relies on the wheel/trackpad — the wheel event
            // still fires inside the iframe doc. Once at an edge, accumulate
            // wheel delta in the same direction and cross a threshold to flip
            // to the next/prev chapter.
            if (scrolled) {
              let overscroll = 0;
              let lastDir = 0;
              let navigating = false;
              doc.addEventListener(
                "wheel",
                (e: WheelEvent) => {
                  if (navigating) return;
                  const { atTop, atBottom } = atEdges();
                  const dir = e.deltaY > 0 ? 1 : -1;
                  const atEdge = (dir > 0 && atBottom) || (dir < 0 && atTop);
                  if (!atEdge) {
                    overscroll = 0;
                    return;
                  }
                  if (dir !== lastDir) {
                    overscroll = 0;
                    lastDir = dir;
                  }
                  overscroll += Math.abs(e.deltaY);
                  if (overscroll > 120) {
                    navigating = true;
                    overscroll = 0;
                    if (dir > 0) rendition.next();
                    else rendition.prev();
                  }
                },
                { passive: true },
              );
            }
          },
        );

        // Reading past a linked section ticks its roadmap step. Progress only
        // grows (never unticks on a scroll back), and writes are debounced and
        // batched. A no-op until resolveTrackedSteps has populated trackedRef,
        // and for visitors (the API hands them no steps).
        //
        // `backfill` (used once, on resuming at a saved position) ticks every
        // section up to here. Otherwise a section ticks only when you *cross*
        // it — moving from before it to at/after it — so a link-jump to a later
        // chapter never claims the chapters you skipped over.
        const syncRoadmap = (cfi: string, backfill = false) => {
          const steps = trackedRef.current;
          const cmp = epubCfiRef.current;
          if (!steps.length || !cmp) return;
          const cmpSafe = (a: string, b: string) => {
            try {
              return cmp.compare(a, b) as number;
            } catch {
              return NaN;
            }
          };
          const last = lastCfiRef.current;
          const fresh: string[] = [];
          for (let i = 0; i < steps.length; i++) {
            if (trackedDoneRef.current.has(steps[i].id)) continue;
            // Counts as read once you reach the next section (or, for the last
            // one, the section itself).
            const threshold = steps[i + 1]?.cfi ?? steps[i].cfi;
            if (!(cmpSafe(cfi, threshold) >= 0)) continue;
            const crossed =
              backfill || last === null || cmpSafe(last, threshold) < 0;
            if (!crossed) continue;
            trackedDoneRef.current.add(steps[i].id);
            trackPendingRef.current.add(steps[i].id);
            fresh.push(steps[i].id);
          }
          lastCfiRef.current = cfi;
          if (!fresh.length) return;
          if (trackTimerRef.current) clearTimeout(trackTimerRef.current);
          trackTimerRef.current = setTimeout(() => {
            const ids = [...trackPendingRef.current];
            trackPendingRef.current.clear();
            markRoadmapStepsRead(bookId, ids);
          }, 1500);
        };

        // Remember the reading position per user (synced via the server) and
        // show "page X of Y" as the reader moves. Debounce the save so page
        // turns don't hammer the API.
        rendition.on("relocated", (location: { start: { cfi: string } }) => {
          const cfi = location.start.cfi;
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => saveProgress(bookId, cfi), 1200);
          syncRoadmap(cfi);

          const total = book.locations.length();
          if (!total) return;
          const cur = book.locations.locationFromCfi(cfi) as unknown as number;
          setProgress({ cur: (cur ?? 0) + 1, total });
        });

        // Desktop mouseup selection — feeds the same "Add note" pill as the
        // selectionchange path above.
        rendition.on("selected", (cfiRange: string) => {
          book
            .getRange(cfiRange)
            .then((range) => {
              const text = range?.toString().trim() ?? "";
              if (text) setCandidate({ cfiRange, text });
            })
            .catch(() => {});
        });

        // Resume where this user left off (synced across their devices).
        const savedCfi = await fetchProgress(bookId).catch(() => null);
        if (destroyed) return;
        // A roadmap step jump (initialLoc) wins over the saved position — but a
        // bad/unresolvable section must never blank out the whole book, so fall
        // back to the saved position (or the start) if the jump fails.
        try {
          await rendition.display(
            initialLocRef.current ?? savedCfi ?? undefined,
          );
        } catch {
          if (initialLocRef.current) {
            await rendition.display(savedCfi ?? undefined).catch(() => {});
          }
        }
        if (destroyed) return;

        rendition.themes.fontSize(`${fontScaleRef.current}%`);

        book.loaded.metadata
          .then((meta) => {
            if (!destroyed && meta?.title) setTitle(meta.title);
          })
          .catch(() => {});

        book.loaded.navigation
          .then((nav) => {
            if (!destroyed) setToc(flattenToc(nav.toc as NavItem[]));
          })
          .catch(() => {});

        setReady(true);

        // Owner-only: link this book's reading to its roadmap. Resolve each
        // linked section to a CFI in the background, then reconcile against
        // wherever we opened (so already-read sections tick immediately).
        (async () => {
          try {
            const steps = await fetchRoadmapStepsForBook(bookId);
            if (destroyed || !steps.length) return;
            epubCfiRef.current = new epubMod.EpubCFI();
            const tracked = await resolveTrackedSteps(
              book,
              epubMod.EpubCFI,
              steps,
            );
            if (destroyed) return;
            trackedRef.current = tracked;
            trackedDoneRef.current = new Set(
              steps.filter((s) => s.done).map((s) => s.id),
            );
            const loc = rendition.currentLocation() as
              | { start?: { cfi?: string } }
              | undefined;
            const cfi = loc?.start?.cfi;
            if (cfi) {
              // Resumed at a saved spot → everything up to here was read.
              // Jumped in via a step link → start fresh; only tick as you go.
              if (initialLocRef.current) lastCfiRef.current = cfi;
              else syncRoadmap(cfi, true);
            }
          } catch {
            /* tracking is best-effort — never break the reader over it */
          }
        })();

        book.locations
          .generate(1000)
          .then(() => {
            if (destroyed) return;
            const loc = rendition.currentLocation() as
              | { start?: { cfi?: string } }
              | undefined;
            const cfi = loc?.start?.cfi;
            const total = book.locations.length();
            if (cfi && total) {
              const cur = book.locations.locationFromCfi(
                cfi,
              ) as unknown as number;
              setProgress({ cur: (cur ?? 0) + 1, total });
            }
          })
          .catch(() => {});
      } catch (e) {
        if (!destroyed) {
          setError("Couldn't open this book.");
          console.error(e);
        }
      }
    })();

    return () => {
      destroyed = true;
      if (saveTimer) clearTimeout(saveTimer);
      // Flush any sections ticked in the last moment before closing.
      if (trackTimerRef.current) clearTimeout(trackTimerRef.current);
      if (trackPending.size) {
        markRoadmapStepsRead(bookId, [...trackPending]);
        trackPending.clear();
      }
      detachOrientation?.();
      localBook?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
      drawn.clear();
    };
  }, [bookId, mode]);

  // Load notes once ready, then poll so friends' notes show up live.
  useEffect(() => {
    if (!ready) return;
    let active = true;

    const load = () =>
      fetchAnnotations(bookId)
        .then((list) => {
          if (active) setAnnotations(list);
        })
        .catch(() => {});

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ready, bookId]);

  // Reconcile drawn highlights with the current annotation list.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !ready) return;

    const drawn = drawnRef.current;
    const next = new Set(annotations.map((a) => a.id));

    // Remove highlights for notes that are gone.
    for (const [id, cfiRange] of drawn) {
      if (!next.has(id)) {
        rendition.annotations.remove(cfiRange, "highlight");
        drawn.delete(id);
      }
    }
    // Add highlights for notes we haven't drawn yet. Tapping a highlight
    // shows that note's comment.
    for (const a of annotations) {
      if (!drawn.has(a.id)) {
        addHighlight(rendition, a.cfiRange, a.mine, () => setActiveNote(a));
        drawn.set(a.id, a.cfiRange);
      }
    }
  }, [annotations, ready]);

  const goPrev = useCallback(() => renditionRef.current?.prev(), []);
  const goNext = useCallback(() => renditionRef.current?.next(), []);

  // Jump to a page (location) via the progress slider.
  function goToPage(page: number) {
    const cfi = bookRef.current?.locations.cfiFromLocation(page - 1);
    if (cfi) renditionRef.current?.display(cfi);
  }

  function goToChapter(href: string) {
    renditionRef.current?.display(href);
    setChaptersOpen(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  async function saveComment() {
    if (!pending) return;
    const selection = pending;
    const comment = draft.trim();
    setPending(null);
    setDraft("");
    try {
      const created = await createAnnotation(bookId, {
        cfiRange: selection.cfiRange,
        text: selection.text,
        comment,
      });
      setAnnotations((prev) => [...prev, created]);
    } catch (e) {
      console.error(e);
      setError("Couldn't save your note.");
    }
  }

  async function removeAnnotation(a: Annotation) {
    setAnnotations((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await deleteAnnotation(a.id);
    } catch (e) {
      console.error(e);
    }
  }

  function jumpTo(cfiRange: string) {
    renditionRef.current?.display(cfiRange);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="bg-bg flex h-screen flex-col">
      <header className="border-line touch-scroll flex items-center gap-2 overflow-x-auto border-b px-3 py-3">
        <button
          onClick={onClose}
          className="text-ink-soft hover:text-ink shrink-0 text-sm"
        >
          ←<span className="hidden sm:inline"> Bookshelf</span>
        </button>
        {toc.length > 0 && (
          <button
            onClick={() => setChaptersOpen((o) => !o)}
            aria-label="Chapters"
            title="Chapters"
            className="border-line text-ink-soft hover:bg-surface shrink-0 rounded-full border px-3 py-1 text-sm"
          >
            📑<span className="hidden sm:inline"> Chapters</span>
          </button>
        )}
        <h1 className="text-ink max-w-[38vw] shrink-0 truncate px-1 font-serif text-base font-medium">
          {title}
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="border-line text-ink-soft flex items-center rounded-full border">
            <button
              onClick={() => changeFont(-10)}
              aria-label="Smaller text"
              title="Smaller text"
              className="hover:text-ink px-2 py-1 text-xs"
            >
              A−
            </button>
            <button
              onClick={() => changeFont(10)}
              aria-label="Larger text"
              title="Larger text"
              className="hover:text-ink px-2 py-1 text-base"
            >
              A+
            </button>
          </div>
          <button
            onClick={toggleMode}
            title={
              mode === "paginated"
                ? "Switch to scroll mode (beta — may jump at chapters)"
                : "Switch to page mode"
            }
            className="border-line text-ink-soft hover:bg-surface shrink-0 rounded-full border px-3 py-1 text-sm"
          >
            {mode === "paginated" ? "📖 Pages" : "📜 Scroll · beta"}
          </button>
          <AmbientMusic />
          <ThemePicker />
          <button
            onClick={share}
            className="border-line text-ink-soft hover:bg-surface rounded-full border px-3 py-1 text-sm"
          >
            {copied ? "Link copied!" : "Share"}
          </button>
          {/* Toggle the notes panel (sheet on mobile, side column on desktop). */}
          <button
            onClick={() => setPanelOpen((o) => !o)}
            aria-label="Notes"
            className="border-line text-ink-soft hover:bg-surface shrink-0 rounded-full border px-3 py-1 text-sm"
          >
            🗒 {annotations.length}
          </button>
        </div>
      </header>

      {/* chapters drawer — left side on desktop, sheet on mobile */}
      {chaptersOpen && (
        <button
          aria-label="Close chapters"
          onClick={() => setChaptersOpen(false)}
          className="bg-ink/20 fixed inset-0 z-30 sm:hidden"
        />
      )}
      <div className="flex min-h-0 flex-1">
        <aside
          className={`${chaptersOpen ? "flex" : "hidden"} border-line bg-surface fixed inset-y-0 left-0 z-40 w-72 max-w-[80%] flex-col border-r shadow-2xl`}
        >
          <div className="border-line flex items-center justify-between border-b px-4 py-3">
            <span className="font-serif text-sm font-medium">Chapters</span>
            <button
              onClick={() => setChaptersOpen(false)}
              className="text-ink-soft hover:text-ink text-sm"
            >
              ✕
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-2">
            {toc.map((c, i) => (
              <li key={i}>
                <button
                  onClick={() => goToChapter(c.href)}
                  className="hover:bg-bg text-ink-soft hover:text-ink block w-full truncate px-4 py-2 text-left text-sm"
                  style={{ paddingLeft: `${1 + c.depth * 0.75}rem` }}
                >
                  {c.label || "Untitled"}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="relative flex min-w-0 flex-1 items-stretch">
          <div className="relative min-w-0 flex-1">
            <div ref={viewerRef} className="h-full w-full" />
            {/* edge tap zones — Pages mode only (scroll mode navigates by
                scrolling + over-scroll at chapter ends). */}
            {mode === "paginated" && (
              <>
                {/* Kept narrow (15%) so they sit over the page margins — any
                    wider and they swallow the long-press needed to select
                    text near the edges on iOS. */}
                <button
                  onClick={goPrev}
                  aria-label="Previous page"
                  className="text-ink-soft/60 hover:text-ink absolute top-0 left-0 z-30 flex h-full w-[15%] items-center justify-start pl-1 text-3xl select-none [-webkit-touch-callout:none]"
                >
                  ‹
                </button>
                <button
                  onClick={goNext}
                  aria-label="Next page"
                  className="text-ink-soft/60 hover:text-ink absolute top-0 right-0 z-30 flex h-full w-[15%] items-center justify-end pr-1 text-3xl select-none [-webkit-touch-callout:none]"
                >
                  ›
                </button>
              </>
            )}
            {!ready && !error && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                Opening book…
              </p>
            )}
            {error && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {/* selection made → floating pill; tapping it opens the composer.
                (Deliberately not automatic: opening the sheet + keyboard
                mid-selection collapses the selection on iOS.) */}
            {candidate && !pending && (
              <button
                onClick={() => {
                  setPending(candidate);
                  setCandidate(null);
                  setPanelOpen(true);
                }}
                className="bg-accent text-accent-ink absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium shadow-lg select-none [-webkit-touch-callout:none] hover:opacity-90"
              >
                💬 Add note
              </button>
            )}

            {/* tap a highlight → show that note's comment */}
            {activeNote && (
              <div className="border-line bg-surface absolute inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-xl border p-3 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-ink-soft border-l-2 pl-2 text-sm italic ${
                      activeNote.mine ? "border-accent" : "border-blue-400"
                    }`}
                  >
                    “{activeNote.text}”
                  </p>
                  <button
                    onClick={() => setActiveNote(null)}
                    aria-label="Close"
                    className="text-ink-soft hover:text-ink shrink-0"
                  >
                    ✕
                  </button>
                </div>
                {activeNote.comment ? (
                  <p className="text-ink mt-2 text-sm">{activeNote.comment}</p>
                ) : (
                  <p className="text-ink-soft mt-2 text-xs italic">
                    No note on this highlight.
                  </p>
                )}
                <p className="text-ink-soft mt-2 text-xs">
                  — {activeNote.mine ? "You" : activeNote.authorName}
                </p>
              </div>
            )}
          </div>
        </div>

        <aside
          className={`${panelOpen ? "flex" : "hidden"} border-line bg-surface fixed inset-x-0 bottom-0 z-20 max-h-[65%] flex-col rounded-t-2xl border-t shadow-2xl sm:static sm:max-h-none! sm:w-80 sm:shrink-0 sm:transform-none! sm:rounded-none sm:border-t-0 sm:border-l sm:shadow-none`}
          // Ride above the iOS on-screen keyboard while composing a note
          // (fixed elements otherwise stay behind it).
          style={
            kbInset > 0
              ? {
                  transform: `translateY(-${kbInset}px)`,
                  maxHeight: `calc(100dvh - ${kbInset}px - 4rem)`,
                }
              : undefined
          }
        >
          {/* Mobile-only sheet handle / close */}
          <button
            onClick={() => setPanelOpen(false)}
            className="text-ink-soft mx-auto mt-2 mb-1 flex items-center gap-1 rounded-full px-3 py-1 text-xs sm:hidden"
          >
            ▾ Close notes
          </button>
          {pending && (
            <div className="border-line border-b p-4">
              <p className="border-accent text-ink-soft mb-2 border-l-2 pl-2 text-sm italic">
                “{pending.text}”
              </p>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a note in the margin…"
                className="border-line text-ink focus:border-accent h-20 w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setPending(null);
                    setDraft("");
                  }}
                  className="text-ink-soft hover:text-ink rounded-md px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveComment}
                  className="bg-accent text-accent-ink rounded-full px-3 py-1.5 text-sm font-medium hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {annotations.length === 0 && !pending ? (
              <p className="text-ink-soft text-sm">
                Select any passage to highlight it and add a note. Notes are
                shared with everyone reading this book.
              </p>
            ) : (
              <ul className="space-y-3">
                {annotations.map((a) => (
                  <li
                    key={a.id}
                    className="group border-line bg-bg/40 rounded-lg border p-3"
                  >
                    <button
                      onClick={() => jumpTo(a.cfiRange)}
                      className="w-full text-left"
                    >
                      <p
                        className={`text-ink-soft border-l-2 pl-2 text-sm ${
                          a.mine ? "border-accent" : "border-blue-400"
                        }`}
                      >
                        “{a.text}”
                      </p>
                      {a.comment && (
                        <p className="text-ink mt-2 text-sm">{a.comment}</p>
                      )}
                    </button>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-ink-soft text-xs">
                        {a.mine ? "You" : a.authorName}
                      </span>
                      {a.mine && (
                        <button
                          onClick={() => removeAnnotation(a)}
                          aria-label="Delete note"
                          title="Delete note"
                          className="text-ink-soft text-base transition-colors hover:text-red-500"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {progress && (
        <footer className="border-line flex items-center gap-3 border-t px-4 py-2">
          <input
            type="range"
            min={1}
            max={progress.total}
            value={progress.cur}
            onChange={(e) => goToPage(Number(e.target.value))}
            aria-label="Jump to page"
            className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
          />
          <span className="text-ink-soft text-xs whitespace-nowrap">
            page {progress.cur} of {progress.total}
          </span>
        </footer>
      )}
    </div>
  );
}
