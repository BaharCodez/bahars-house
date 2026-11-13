import type { Block } from "@/app/lib/article";
import { textOf } from "@/app/lib/daily/highlights";

export interface PopoverPosition {
  top: number;
  left: number;
}

/** A selection that's waiting to be marked. */
export interface PendingSelection extends PopoverPosition {
  block: number;
  start: number;
  end: number;
  quote: string;
  clipped: boolean;
}

/* A selection inside the body becomes a pending highlight. Highlights stay
   inside one block: dragging past the end of a paragraph clips there, which
   is at least visible rather than silently wrong. */
export function readSelection(
  host: HTMLElement,
  blocks: Block[] | null,
): PendingSelection | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return undefined;
  const range = selection.getRangeAt(0);
  if (!host.contains(range.startContainer)) return undefined;

  const startEl = blockElementOf(range.startContainer);
  if (!startEl) return undefined;
  const blockIndex = Number(startEl.dataset.block);
  const blockText = textOf(blocks?.[blockIndex]);
  if (blockText == null) return undefined;

  const start = offsetIn(startEl, range.startContainer, range.startOffset);
  if (start < 0) return undefined;

  const sameBlock = blockElementOf(range.endContainer) === startEl;
  const rawEnd = sameBlock
    ? offsetIn(startEl, range.endContainer, range.endOffset)
    : blockText.length;
  const end = Math.min(rawEnd < 0 ? blockText.length : rawEnd, blockText.length);
  if (end - start < 2) return undefined;

  return {
    block: blockIndex,
    start,
    end,
    quote: blockText.slice(start, end),
    clipped: !sameBlock,
    ...positionBelow(range.getBoundingClientRect(), host),
  };
}

/** Just under `rect`, measured from the host the popovers are placed in. */
export function positionBelow(rect: DOMRect, host: HTMLElement) {
  const hostRect = host.getBoundingClientRect();
  return {
    top: rect.bottom - hostRect.top + 8,
    left: Math.max(0, rect.left - hostRect.left),
  };
}

function blockElementOf(node: Node) {
  const element =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  return element?.closest<HTMLElement>("[data-block]");
}

/* Character offset of (node, offset) within a block element, counting only
   the article's own text — CSS-generated bullets and pencil marks aren't in
   the text nodes, so they can't throw the count off. */
function offsetIn(root: HTMLElement, node: Node, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === node) return total + offset;
    total += n.textContent?.length ?? 0;
  }
  // The caret sat on an element rather than a text node (a click on the very
  // edge of a paragraph) — fall back to the whole length.
  return node === root ? total : -1;
}
