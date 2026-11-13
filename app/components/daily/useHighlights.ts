import { useState } from "react";
import { sendJson } from "@/app/lib/daily/http";
import type { Grasp, Highlight } from "@/app/lib/daily/highlights";
import type { PendingSelection } from "./selection";

/** The article's highlights, kept in step with the server optimistically. */
export function useHighlights(bookmarkId: string, initial: Highlight[]) {
  const [highlights, setHighlights] = useState(initial);

  async function create(selection: PendingSelection, grasp: Grasp) {
    const res = await sendJson("/api/highlights", "POST", {
      bookmarkId,
      block: selection.block,
      start: selection.start,
      end: selection.end,
      quote: selection.quote,
      grasp,
      note: "",
    });
    if (!res.ok) return undefined;
    const saved: Highlight = await res.json();
    setHighlights((hs) => [...hs, saved]);
    return saved;
  }

  async function patch(id: string, change: Partial<Highlight>) {
    const before = highlights.find((h) => h.id === id);
    if (!before) return;
    setHighlights((hs) =>
      hs.map((h) => (h.id === id ? { ...h, ...change } : h)),
    );
    const res = await sendJson(`/api/highlights/${id}`, "PATCH", change);
    if (!res.ok) setHighlights((hs) => hs.map((h) => (h.id === id ? before : h)));
  }

  async function remove(id: string) {
    const before = highlights;
    setHighlights((hs) => hs.filter((h) => h.id !== id));
    const res = await fetch(`/api/highlights/${id}`, { method: "DELETE" });
    if (!res.ok) setHighlights(before);
  }

  return { highlights, create, patch, remove };
}
