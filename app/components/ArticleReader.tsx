"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import type { Block } from "@/app/lib/article";

export type Grasp = "got" | "half" | "lost";

export interface Highlight {
  id: string;
  block: number;
  start: number;
  end: number;
  quote: string;
  grasp: Grasp;
  note: string;
}

interface Bookmark {
  id: string;
  url: string;
  title: string;
  source: string;
  byline: string;
  wordCount: number;
}

export const GRASP_LABEL: Record<Grasp, string> = {
  got: "got it",
  half: "half",
  lost: "lost me",
};

const GRASP_GLYPH: Record<Grasp, string> = { got: "✓", half: "~", lost: "?" };

const GRASP_ORDER: Grasp[] = ["got", "half", "lost"];

/* The "select any sentence" line lives in localStorage, not the database:
   it's about this browser having learned the trick, not about the reading.
   A hand-rolled store so useSyncExternalStore can re-render on dismissal. */
const HINT_KEY = "reader-hint-dismissed";
let hintListeners: (() => void)[] = [];

function subscribeHint(onChange: () => void) {
  hintListeners.push(onChange);
  return () => {
    hintListeners = hintListeners.filter((l) => l !== onChange);
  };
}

function dismissHint() {
  localStorage.setItem(HINT_KEY, "done");
  for (const l of hintListeners) l();
}

/* Where a highlight actually sits in the body right now. The article can be
   pulled in again and come back slightly different, so every highlight is
   re-found by its quote before it's drawn; anything that can't be found is an
   orphan and shows in the list below rather than on the page. */
interface Anchored {
  h: Highlight;
  block: number;
  start: number;
  end: number;
}

function textOf(block: Block | undefined) {
  return block && block.t !== "img" ? block.s : null;
}

function anchor(h: Highlight, blocks: Block[]): Anchored | null {
  const own = textOf(blocks[h.block]);
  if (own?.slice(h.start, h.end) === h.quote) {
    return { h, block: h.block, start: h.start, end: h.end };
  }
  // Same paragraph, shifted along.
  if (own) {
    const at = own.indexOf(h.quote);
    if (at !== -1) {
      return { h, block: h.block, start: at, end: at + h.quote.length };
    }
  }
  // Moved paragraphs entirely — take the first block that still says it.
  for (let i = 0; i < blocks.length; i++) {
    const s = textOf(blocks[i]);
    const at = s?.indexOf(h.quote) ?? -1;
    if (at !== -1) {
      return { h, block: i, start: at, end: at + h.quote.length };
    }
  }
  return null;
}

/* Character offset of (node, offset) within a block element, counting only
   the article's own text — CSS-generated bullets and pencil marks aren't in
   the text nodes, so they can't throw the count off. */
function offsetIn(root: HTMLElement, node: Node, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let n = walker.nextNode();
  while (n) {
    if (n === node) return total + offset;
    total += n.textContent?.length ?? 0;
    n = walker.nextNode();
  }
  // The caret sat on an element rather than a text node (a click on the very
  // edge of a paragraph) — fall back to the whole length.
  return node === root ? total : -1;
}

export default function ArticleReader({
  bookmark,
  blocks: initialBlocks,
  highlights: initialHighlights,
}: {
  bookmark: Bookmark;
  blocks: Block[] | null;
  highlights: Highlight[];
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [highlights, setHighlights] = useState(initialHighlights);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const pulledOnce = useRef(false);

  // SSR says "dismissed" (there's no localStorage); the real answer arrives
  // on hydration, so the hint never flashes for someone who's put it away.
  const showHint = useSyncExternalStore(
    subscribeHint,
    () => localStorage.getItem(HINT_KEY) !== "done",
    () => false,
  );

  /* The popover: either over a fresh selection, or over an existing mark. */
  const [pending, setPending] = useState<{
    block: number;
    start: number;
    end: number;
    quote: string;
    top: number;
    left: number;
    clipped: boolean;
  } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openAt, setOpenAt] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [draftNote, setDraftNote] = useState("");

  const pullIn = useCallback(
    async (body: { mode: "fetch" } | { mode: "paste"; text: string }) => {
      setPulling(true);
      setPullError(null);
      try {
        const res = await fetch(`/api/bookmarks/${bookmark.id}/article`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPullError(data.error ?? "Couldn't pull that one in.");
          return false;
        }
        setBlocks(data.blocks as Block[]);
        setPasting(false);
        setPasted("");
        return true;
      } catch {
        setPullError("Couldn't pull that one in.");
        return false;
      } finally {
        setPulling(false);
      }
    },
    [bookmark.id],
  );

  // Nothing cached yet — go and get it, once.
  useEffect(() => {
    if (blocks || pulledOnce.current) return;
    pulledOnce.current = true;
    void pullIn({ mode: "fetch" });
  }, [blocks, pullIn]);

  const anchored = useMemo(() => {
    if (!blocks) return { byBlock: new Map<number, Anchored[]>(), orphans: [] };
    const byBlock = new Map<number, Anchored[]>();
    const orphans: Highlight[] = [];
    for (const h of highlights) {
      const a = anchor(h, blocks);
      if (!a) {
        orphans.push(h);
        continue;
      }
      const list = byBlock.get(a.block) ?? [];
      list.push(a);
      byBlock.set(a.block, list);
    }
    for (const list of byBlock.values()) list.sort((x, y) => x.start - y.start);
    return { byBlock, orphans };
  }, [blocks, highlights]);

  const counts = useMemo(() => {
    const c: Record<Grasp, number> = { got: 0, half: 0, lost: 0 };
    for (const h of highlights) c[h.grasp]++;
    return c;
  }, [highlights]);

  const fuzzy = useMemo(
    () => highlights.filter((h) => h.grasp !== "got"),
    [highlights],
  );

  const closePopovers = useCallback(() => {
    setPending(null);
    setOpenId(null);
    setOpenAt(null);
    setDraftNote("");
  }, []);

  /* Escape closes it, and so does clicking anywhere off it — a popover that
     sits there until you pick something is a nag, not a prompt. Note edits
     save on blur, so closing this way never loses what you typed. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopovers();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (
        target?.closest("[data-popover]") ||
        target?.closest("mark[data-hl]")
      ) {
        return;
      }
      closePopovers();
    };
    window.addEventListener("keydown", onKey);
    // Capture, so it lands before a fresh selection opens the next popover.
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [closePopovers]);

  /* A selection inside the body becomes a pending highlight. Highlights stay
     inside one block: dragging past the end of a paragraph clips there, which
     is at least visible rather than silently wrong. */
  function onSelect() {
    const sel = window.getSelection();
    const host = bodyRef.current;
    if (!sel || sel.isCollapsed || !host) return;
    const range = sel.getRangeAt(0);
    if (!host.contains(range.startContainer)) return;

    const startEl = (
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as Element)
    )?.closest<HTMLElement>("[data-block]");
    if (!startEl) return;

    const blockIndex = Number(startEl.dataset.block);
    const blockText = textOf(blocks?.[blockIndex]);
    if (blockText == null) return;

    const start = offsetIn(startEl, range.startContainer, range.startOffset);
    if (start < 0) return;

    const endEl = (
      range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement
        : (range.endContainer as Element)
    )?.closest<HTMLElement>("[data-block]");
    const sameBlock = endEl === startEl;
    const rawEnd = sameBlock
      ? offsetIn(startEl, range.endContainer, range.endOffset)
      : blockText.length;
    const end = Math.min(
      rawEnd < 0 ? blockText.length : rawEnd,
      blockText.length,
    );
    if (end - start < 2) return;

    const rect = range.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    setOpenId(null);
    setDraftNote("");
    setPending({
      block: blockIndex,
      start,
      end,
      quote: blockText.slice(start, end),
      top: rect.bottom - hostRect.top + 8,
      left: Math.max(0, rect.left - hostRect.left),
      clipped: !sameBlock,
    });
  }

  async function saveHighlight(grasp: Grasp) {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookmarkId: bookmark.id,
          block: pending.block,
          start: pending.start,
          end: pending.end,
          quote: pending.quote,
          grasp,
          note: "",
        }),
      });
      if (!res.ok) return;
      const saved: Highlight = await res.json();
      setHighlights((hs) => [...hs, saved]);
      window.getSelection()?.removeAllRanges();
      // Straight into "say why" — optional, but it's the useful half.
      setPending(null);
      setOpenId(saved.id);
      setOpenAt({ top: pending.top, left: pending.left });
      setDraftNote("");
    } finally {
      setBusy(false);
    }
  }

  async function patchHighlight(id: string, patch: Partial<Highlight>) {
    const before = highlights.find((h) => h.id === id);
    if (!before) return;
    setHighlights((hs) =>
      hs.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    );
    const res = await fetch(`/api/highlights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok)
      setHighlights((hs) => hs.map((h) => (h.id === id ? before : h)));
  }

  async function removeHighlight(id: string) {
    const before = highlights;
    setHighlights((hs) => hs.filter((h) => h.id !== id));
    closePopovers();
    const res = await fetch(`/api/highlights/${id}`, { method: "DELETE" });
    if (!res.ok) setHighlights(before);
  }

  function openMark(h: Highlight, el: HTMLElement) {
    const host = bodyRef.current;
    if (!host) return;
    const rect = el.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    setPending(null);
    setOpenId(h.id);
    setDraftNote(h.note);
    setOpenAt({
      top: rect.bottom - hostRect.top + 8,
      left: Math.max(0, rect.left - hostRect.left),
    });
  }

  /* Split a block's text into plain runs and marked runs. Overlaps are
     resolved by whoever starts first; a highlight buried inside another still
     shows in the lists below. */
  function renderBlockText(index: number, text: string) {
    const marks = anchored.byBlock.get(index);
    if (!marks?.length) return text;

    const out: React.ReactNode[] = [];
    let cursor = 0;
    for (const m of marks) {
      const start = Math.max(m.start, cursor);
      if (m.end <= start) continue; // fully swallowed by the mark before it
      if (start > cursor) out.push(text.slice(cursor, start));
      out.push(
        <mark
          key={m.h.id}
          data-hl={m.h.id}
          className={["hl", `hl-${m.h.grasp}`, m.h.note ? "hl-note" : ""].join(
            " ",
          )}
          title={m.h.note || GRASP_LABEL[m.h.grasp]}
          onClick={(e) => openMark(m.h, e.currentTarget)}
        >
          {text.slice(start, m.end)}
        </mark>,
      );
      cursor = m.end;
    }
    if (!out.length) return text;
    if (cursor < text.length) out.push(text.slice(cursor));
    return out;
  }

  function renderBlock(b: Block, i: number) {
    if (b.t === "img") {
      return (
        // Someone else's image on someone else's host — plain <img> so we
        // don't proxy or re-host it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={b.src}
          alt={b.alt}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      );
    }
    const content = renderBlockText(i, b.s);
    // data-block is what a selection is measured against — every text block
    // carries it, images don't (there's nothing to highlight).
    if (b.t === "h2")
      return (
        <h2 key={i} data-block={i}>
          {content}
        </h2>
      );
    if (b.t === "h3")
      return (
        <h3 key={i} data-block={i}>
          {content}
        </h3>
      );
    if (b.t === "quote")
      return (
        <blockquote key={i} data-block={i}>
          {content}
        </blockquote>
      );
    if (b.t === "code")
      return (
        <pre key={i} data-block={i}>
          {content}
        </pre>
      );
    return (
      <p key={i} data-block={i} className={b.t === "li" ? "reader-li" : ""}>
        {content}
      </p>
    );
  }

  const open = openId ? highlights.find((h) => h.id === openId) : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-24 sm:px-8">
      {/* what this read is, and how it's landing so far */}
      <div className="border-line bg-surface mb-6 rounded-sm border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
            {bookmark.source || new URL(bookmark.url).hostname}
          </span>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noreferrer"
            className="text-ink-soft hover:text-accent font-mono text-xs"
          >
            the original ↗
          </a>
        </div>
        <h1 className="text-ink mt-1 font-serif text-2xl leading-snug">
          {bookmark.title}
        </h1>
        {bookmark.byline && (
          <p className="text-ink-soft mt-1 text-sm">{bookmark.byline}</p>
        )}
        <div className="text-ink-soft mt-3 flex flex-wrap gap-4 font-mono text-xs">
          {GRASP_ORDER.map((g) => (
            <span key={g}>
              <span className={`hl hl-${g} px-1`}>{GRASP_GLYPH[g]}</span>{" "}
              {GRASP_LABEL[g]} {counts[g]}
            </span>
          ))}
        </div>
        {/* the how-to, until you know it — then it's gone for good */}
        {showHint && (
          <p className="text-ink-soft mt-2 flex items-baseline gap-2 text-xs">
            <span className="flex-1">
              Select any sentence to mark how well it landed.
            </span>
            <button
              type="button"
              onClick={dismissHint}
              title="got it — stop showing this"
              className="hover:text-ink shrink-0 font-mono"
            >
              ×
            </button>
          </p>
        )}
      </div>

      {/* the body */}
      {blocks ? (
        <div ref={bodyRef} className="relative">
          <div
            className="article reader-body"
            onMouseUp={onSelect}
            onTouchEnd={onSelect}
          >
            {blocks.map(renderBlock)}
          </div>

          {/* fresh selection */}
          {pending && (
            <div
              data-popover
              className="border-line bg-surface absolute z-20 w-60 rounded-sm border p-2 shadow-lg"
              style={{ top: pending.top, left: pending.left }}
            >
              <div className="flex gap-1">
                {GRASP_ORDER.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => saveHighlight(g)}
                    disabled={busy}
                    className={`hl hl-${g} font-pixel flex-1 rounded-sm px-2 py-1.5 text-[11px]`}
                  >
                    {GRASP_GLYPH[g]} {GRASP_LABEL[g]}
                  </button>
                ))}
              </div>
              {pending.clipped && (
                <p className="text-ink-soft mt-2 font-mono text-[10px]">
                  clipped to the end of this paragraph
                </p>
              )}
            </div>
          )}

          {/* an existing mark */}
          {open && openAt && (
            <div
              data-popover
              className="border-line bg-surface absolute z-20 w-64 rounded-sm border p-2 shadow-lg"
              style={{ top: openAt.top, left: openAt.left }}
            >
              <div className="flex gap-1">
                {GRASP_ORDER.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => patchHighlight(open.id, { grasp: g })}
                    className={`font-pixel flex-1 rounded-sm px-2 py-1.5 text-[11px] ${
                      open.grasp === g
                        ? `hl hl-${g} ring-accent ring-1`
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {GRASP_GLYPH[g]} {GRASP_LABEL[g]}
                  </button>
                ))}
              </div>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                onBlur={() => {
                  if (draftNote !== open.note) {
                    void patchHighlight(open.id, { note: draftNote });
                  }
                }}
                rows={2}
                placeholder={
                  open.grasp === "got"
                    ? "say it back in your own words…"
                    : "what's missing? (optional)"
                }
                className="border-line text-ink focus:border-accent mt-2 w-full resize-none rounded-sm border bg-transparent px-2 py-1 text-xs outline-none"
              />
              <div className="mt-1 flex justify-between">
                <button
                  type="button"
                  onClick={() => removeHighlight(open.id)}
                  className="text-ink-soft hover:text-ink font-mono text-[11px]"
                >
                  remove
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (draftNote !== open.note) {
                      void patchHighlight(open.id, { note: draftNote });
                    }
                    closePopovers();
                  }}
                  className="text-accent font-mono text-[11px] hover:underline"
                >
                  done
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border-line bg-surface rounded-sm border p-5">
          {pulling ? (
            <p className="text-ink-soft text-sm">
              pulling the article in from {new URL(bookmark.url).hostname}…
            </p>
          ) : (
            <>
              <p className="text-ink text-sm">
                {pullError ?? "This one hasn't been pulled in yet."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void pullIn({ mode: "fetch" })}
                  className="font-pixel bg-accent text-accent-ink rounded-full px-4 py-2 text-sm hover:opacity-90"
                >
                  try again
                </button>
                <button
                  type="button"
                  onClick={() => setPasting((p) => !p)}
                  className="font-pixel border-line text-ink hover:bg-ink/5 rounded-full border px-4 py-2 text-sm"
                >
                  paste it in
                </button>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-pixel text-ink-soft hover:text-ink px-2 py-2 text-sm"
                >
                  open the original ↗
                </a>
              </div>
              {pasting && (
                <div className="mt-3">
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    rows={10}
                    placeholder="paste the article text here — blank lines separate paragraphs"
                    className="border-line text-ink focus:border-accent w-full rounded-sm border bg-transparent p-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    disabled={!pasted.trim() || pulling}
                    onClick={() => void pullIn({ mode: "paste", text: pasted })}
                    className="font-pixel bg-accent text-accent-ink mt-2 rounded-full px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    save it
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* the point of the whole thing */}
      {blocks && (
        <section className="border-line bg-surface mt-10 rounded-sm border p-5">
          <h2 className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
            what I don&apos;t get yet
          </h2>
          {fuzzy.length === 0 ? (
            <p className="text-ink-soft mt-2 text-sm">
              {highlights.length === 0
                ? "Nothing marked up yet. Highlight as you read — the fuzzy bits collect here."
                : "Nothing fuzzy left in this one. 🎉"}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {fuzzy.map((h) => (
                <li
                  key={h.id}
                  className="border-line border-b pb-3 last:border-0"
                >
                  <p className={`hl hl-${h.grasp} text-ink inline text-sm`}>
                    “{h.quote}”
                  </p>
                  {h.note && (
                    <p className="text-ink-soft mt-1 text-sm italic">
                      {h.note}
                    </p>
                  )}
                  <div className="mt-1 flex gap-3">
                    <button
                      type="button"
                      onClick={() => patchHighlight(h.id, { grasp: "got" })}
                      title="it landed — turn it green"
                      className="text-ink-soft hover:text-ink font-mono text-[11px]"
                    >
                      ✓ I get it now
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHighlight(h.id)}
                      title="drop the mark entirely"
                      className="text-ink-soft hover:text-ink font-mono text-[11px]"
                    >
                      remove ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {anchored.orphans.length > 0 && (
            <div className="mt-5">
              <h3 className="text-ink-soft font-mono text-[11px] tracking-[0.2em] uppercase">
                marks whose text has moved
              </h3>
              <ul className="mt-2 space-y-2">
                {anchored.orphans.map((h) => (
                  <li key={h.id} className="text-ink-soft text-sm">
                    “{h.quote}”{" "}
                    <button
                      type="button"
                      onClick={() => removeHighlight(h.id)}
                      className="hover:text-ink font-mono text-[11px]"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => void pullIn({ mode: "fetch" })}
            disabled={pulling}
            className="text-ink-soft hover:text-ink mt-5 font-mono text-[11px]"
          >
            {pulling ? "…" : "pull the article in again"}
          </button>
          {pullError && (
            <p className="text-accent-2 mt-2 text-xs">{pullError}</p>
          )}
        </section>
      )}

      <Link
        href="/daily"
        className="text-ink-soft hover:text-accent mt-8 inline-block font-mono text-xs"
      >
        ← back to the shelf
      </Link>
    </div>
  );
}
