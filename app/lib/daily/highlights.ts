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

export const GRASP_LABEL: Record<Grasp, string> = {
  got: "got it",
  half: "half",
  lost: "lost me",
};

export const GRASP_GLYPH: Record<Grasp, string> = {
  got: "✓",
  half: "~",
  lost: "?",
};

export const GRASP_ORDER: Grasp[] = ["got", "half", "lost"];

export function isGrasp(value: string): value is Grasp {
  return (GRASP_ORDER as string[]).includes(value);
}

export function countByGrasp(highlights: Highlight[]) {
  const counts: Record<Grasp, number> = { got: 0, half: 0, lost: 0 };
  for (const h of highlights) counts[h.grasp]++;
  return counts;
}

export function textOf(block: Block | undefined) {
  return block && block.t !== "img" ? block.s : null;
}

/* Where a highlight actually sits in the body right now. The article can be
   pulled in again and come back slightly different, so every highlight is
   re-found by its quote before it's drawn; anything that can't be found is an
   orphan and shows in the list below rather than on the page. */
export interface Anchored {
  h: Highlight;
  block: number;
  start: number;
  end: number;
}

export interface AnchoredHighlights {
  byBlock: Map<number, Anchored[]>;
  orphans: Highlight[];
}

export function anchorAll(
  highlights: Highlight[],
  blocks: Block[] | null,
): AnchoredHighlights {
  const byBlock = new Map<number, Anchored[]>();
  const orphans: Highlight[] = [];
  if (!blocks) return { byBlock, orphans };
  for (const h of highlights) {
    const anchored = anchor(h, blocks);
    if (!anchored) {
      orphans.push(h);
      continue;
    }
    const list = byBlock.get(anchored.block) ?? [];
    list.push(anchored);
    byBlock.set(anchored.block, list);
  }
  for (const list of byBlock.values()) list.sort((x, y) => x.start - y.start);
  return { byBlock, orphans };
}

function anchor(h: Highlight, blocks: Block[]): Anchored | undefined {
  const own = textOf(blocks[h.block]);
  if (own?.slice(h.start, h.end) === h.quote) {
    return { h, block: h.block, start: h.start, end: h.end };
  }
  // Same paragraph, shifted along; failing that, moved paragraphs entirely —
  // take the first block that still says it.
  if (own) {
    const shifted = locate(h, own, h.block);
    if (shifted) return shifted;
  }
  for (let i = 0; i < blocks.length; i++) {
    const text = textOf(blocks[i]);
    const moved = text == null ? undefined : locate(h, text, i);
    if (moved) return moved;
  }
  return undefined;
}

function locate(h: Highlight, text: string, block: number) {
  const at = text.indexOf(h.quote);
  if (at === -1) return undefined;
  return { h, block, start: at, end: at + h.quote.length };
}
