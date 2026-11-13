import { useEffect, useRef, type RefObject } from "react";
import type { Rendition } from "epubjs";
import type { Annotation } from "@/app/lib/types";
import { KIND_META } from "./kinds";

// Someone else's note stays one neutral colour: their categories are theirs,
// and mixing them into your own palette would make the wall of colour lie.
const OTHERS_STYLE = { fill: "#60a5fa", "fill-opacity": "0.30" };

type DrawnMark = { cfiRange: string; kind: string };

interface HighlightOptions {
  renditionRef: RefObject<Rendition | null>;
  ready: boolean;
  annotations: Annotation[];
  onTap: (annotation: Annotation) => void;
}

// Keeps the highlights drawn in the book in step with the annotation list,
// adding and removing only the delta.
export function useHighlights({
  renditionRef,
  ready,
  annotations,
  onTap,
}: HighlightOptions) {
  // What's drawn on which rendition: a rebuilt rendition starts blank. The
  // kind is tracked too: re-categorising a mark changes its colour, which
  // means removing and re-adding it even though the id hasn't changed.
  const drawnRef = useRef<{
    rendition: Rendition | null;
    marks: Map<string, DrawnMark>;
  }>({ rendition: null, marks: new Map() });

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !ready) return;
    if (drawnRef.current.rendition !== rendition) {
      drawnRef.current = { rendition, marks: new Map() };
    }
    const drawn = drawnRef.current.marks;
    const byId = new Map(annotations.map((a) => [a.id, a]));

    // The colour is baked in at draw time, so a changed kind means a redraw.
    for (const [id, mark] of drawn) {
      const current = byId.get(id);
      if (current && current.kind === mark.kind) continue;
      rendition.annotations.remove(mark.cfiRange, "highlight");
      drawn.delete(id);
    }
    for (const annotation of annotations) {
      if (drawn.has(annotation.id)) continue;
      drawHighlight(rendition, annotation, () => onTap(annotation));
      drawn.set(annotation.id, {
        cfiRange: annotation.cfiRange,
        kind: annotation.kind,
      });
    }
  }, [annotations, ready, renditionRef, onTap]);
}

function drawHighlight(
  rendition: Rendition,
  { cfiRange, mine, kind }: Annotation,
  onClick: () => void,
) {
  // Fall back rather than trust the kind: it arrives as a bare string from the
  // API, and an unrecognised one must not take the whole draw loop down with
  // it — one weird row would leave every highlight in the book undrawn.
  const fill = (KIND_META[kind] ?? KIND_META.idea).fill;
  try {
    rendition.annotations.add(
      "highlight",
      cfiRange,
      {},
      onClick,
      "sr-highlight",
      mine ? { fill, "fill-opacity": "0.35" } : OTHERS_STYLE,
    );
  } catch (e) {
    // A CFI that no longer resolves (book re-uploaded, say) throws here.
    console.error("Couldn't draw highlight", cfiRange, e);
  }
}
