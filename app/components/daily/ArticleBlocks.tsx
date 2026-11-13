import type { ReactNode } from "react";
import type { Block } from "@/app/lib/article";
import {
  GRASP_LABEL,
  type Anchored,
  type Highlight,
} from "@/app/lib/daily/highlights";

const TAG_OF = {
  h2: "h2",
  h3: "h3",
  quote: "blockquote",
  code: "pre",
} as const;

type OpenMark = (h: Highlight, el: HTMLElement) => void;

/** The article body, with each highlight drawn over its run of text. */
export default function ArticleBlocks({
  blocks,
  marksByBlock,
  onOpenMark,
}: {
  blocks: Block[];
  marksByBlock: Map<number, Anchored[]>;
  onOpenMark: OpenMark;
}) {
  return blocks.map((b, i) => {
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
    const content = markedText(b.s, marksByBlock.get(i), onOpenMark);
    // data-block is what a selection is measured against — every text block
    // carries it, images don't (there's nothing to highlight).
    if (b.t === "p" || b.t === "li") {
      return (
        <p key={i} data-block={i} className={b.t === "li" ? "reader-li" : ""}>
          {content}
        </p>
      );
    }
    const Tag = TAG_OF[b.t];
    return (
      <Tag key={i} data-block={i}>
        {content}
      </Tag>
    );
  });
}

/* Split a block's text into plain runs and marked runs. Overlaps are
   resolved by whoever starts first; a highlight buried inside another still
   shows in the lists below. */
function markedText(
  text: string,
  marks: Anchored[] | undefined,
  onOpenMark: OpenMark,
) {
  if (!marks?.length) return text;

  const runs: ReactNode[] = [];
  let cursor = 0;
  for (const m of marks) {
    const start = Math.max(m.start, cursor);
    if (m.end <= start) continue; // fully swallowed by the mark before it
    if (start > cursor) runs.push(text.slice(cursor, start));
    runs.push(
      <mark
        key={m.h.id}
        data-hl={m.h.id}
        className={["hl", `hl-${m.h.grasp}`, m.h.note ? "hl-note" : ""].join(
          " ",
        )}
        title={m.h.note || GRASP_LABEL[m.h.grasp]}
        onClick={(e) => onOpenMark(m.h, e.currentTarget)}
      >
        {text.slice(start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }
  if (!runs.length) return text;
  if (cursor < text.length) runs.push(text.slice(cursor));
  return runs;
}
