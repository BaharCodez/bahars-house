"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Block } from "@/app/lib/article";
import {
  anchorAll,
  countByGrasp,
  type Grasp,
  type Highlight,
} from "@/app/lib/daily/highlights";
import ArticleBlocks from "./daily/ArticleBlocks";
import MarkPopover from "./daily/MarkPopover";
import PullInPanel from "./daily/PullInPanel";
import ReaderFuzzyNotes from "./daily/ReaderFuzzyNotes";
import ReaderHeader from "./daily/ReaderHeader";
import SelectionPopover from "./daily/SelectionPopover";
import { positionBelow, readSelection } from "./daily/selection";
import type { ReaderBookmark } from "./daily/types";
import { useArticleBody } from "./daily/useArticleBody";
import { useHighlights } from "./daily/useHighlights";
import { usePopovers } from "./daily/usePopovers";

export { GRASP_LABEL } from "@/app/lib/daily/highlights";
export type { Grasp, Highlight } from "@/app/lib/daily/highlights";

export default function ArticleReader({
  bookmark,
  blocks: initialBlocks,
  highlights: initialHighlights,
}: {
  bookmark: ReaderBookmark;
  blocks: Block[] | null;
  highlights: Highlight[];
}) {
  const { blocks, pulling, pullError, pullIn } = useArticleBody(
    bookmark.id,
    initialBlocks,
  );
  const {
    highlights,
    create: createHighlight,
    patch: patchHighlight,
    remove: deleteHighlight,
  } = useHighlights(bookmark.id, initialHighlights);
  const popovers = usePopovers();
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const anchored = useMemo(
    () => anchorAll(highlights, blocks),
    [blocks, highlights],
  );
  const counts = useMemo(
    () => countByGrasp(highlights),
    [highlights],
  );

  function onSelect() {
    const host = bodyRef.current;
    if (!host) return;
    const selection = readSelection(host, blocks);
    if (selection) popovers.showSelection(selection);
  }

  async function saveHighlight(grasp: Grasp) {
    const selection = popovers.pending;
    if (!selection || saving) return;
    setSaving(true);
    try {
      const saved = await createHighlight(selection, grasp);
      if (!saved) return;
      window.getSelection()?.removeAllRanges();
      // Straight into "say why" — optional, but it's the useful half.
      popovers.showMark({
        id: saved.id,
        note: "",
        at: { top: selection.top, left: selection.left },
      });
    } finally {
      setSaving(false);
    }
  }

  function removeHighlight(id: string) {
    popovers.close();
    void deleteHighlight(id);
  }

  function openMark(h: Highlight, el: HTMLElement) {
    const host = bodyRef.current;
    if (!host) return;
    popovers.showMark({
      id: h.id,
      note: h.note,
      at: positionBelow(el.getBoundingClientRect(), host),
    });
  }

  const openMarkHighlight = popovers.openId
    ? highlights.find((h) => h.id === popovers.openId)
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-24 sm:px-8">
      <ReaderHeader bookmark={bookmark} counts={counts} />

      {blocks ? (
        <div ref={bodyRef} className="relative">
          <div
            className="article reader-body"
            onMouseUp={onSelect}
            onTouchEnd={onSelect}
          >
            <ArticleBlocks
              blocks={blocks}
              marksByBlock={anchored.byBlock}
              onOpenMark={openMark}
            />
          </div>

          {popovers.pending && (
            <SelectionPopover
              selection={popovers.pending}
              saving={saving}
              onPick={saveHighlight}
            />
          )}

          {openMarkHighlight && popovers.openAt && (
            <MarkPopover
              mark={openMarkHighlight}
              at={popovers.openAt}
              draftNote={popovers.draftNote}
              onDraftNote={popovers.setDraftNote}
              onRegrade={(grasp) =>
                patchHighlight(openMarkHighlight.id, { grasp })
              }
              onSaveNote={(note) =>
                void patchHighlight(openMarkHighlight.id, { note })
              }
              onRemove={() => removeHighlight(openMarkHighlight.id)}
              onDone={popovers.close}
            />
          )}
        </div>
      ) : (
        <PullInPanel
          url={bookmark.url}
          pulling={pulling}
          pullError={pullError}
          onPullIn={(request) => void pullIn(request)}
        />
      )}

      {blocks && (
        <ReaderFuzzyNotes
          highlights={highlights}
          orphans={anchored.orphans}
          pulling={pulling}
          pullError={pullError}
          onGotIt={(id) => patchHighlight(id, { grasp: "got" })}
          onRemove={removeHighlight}
          onPullAgain={() => void pullIn({ mode: "fetch" })}
        />
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
