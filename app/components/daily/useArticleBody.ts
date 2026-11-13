import { useCallback, useEffect, useRef, useState } from "react";
import type { Block } from "@/app/lib/article";
import { readJsonOrEmpty, sendJson } from "@/app/lib/daily/http";

export type PullRequest = { mode: "fetch" } | { mode: "paste"; text: string };

const PULL_FAILED = "Couldn't pull that one in.";

/** The article's cached body, and pulling it in (again) from the source. */
export function useArticleBody(bookmarkId: string, initialBlocks: Block[] | null) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const pulledOnce = useRef(false);

  const pullIn = useCallback(
    async (request: PullRequest) => {
      setPulling(true);
      setPullError(null);
      try {
        const res = await sendJson(
          `/api/bookmarks/${bookmarkId}/article`,
          "POST",
          request,
        );
        const data = await readJsonOrEmpty<{ error: string; blocks: Block[] }>(
          res,
        );
        if (!res.ok) {
          setPullError(data.error ?? PULL_FAILED);
          return false;
        }
        setBlocks(data.blocks as Block[]);
        return true;
      } catch {
        setPullError(PULL_FAILED);
        return false;
      } finally {
        setPulling(false);
      }
    },
    [bookmarkId],
  );

  // Nothing cached yet — go and get it, once.
  useEffect(() => {
    if (blocks || pulledOnce.current) return;
    pulledOnce.current = true;
    void pullIn({ mode: "fetch" });
  }, [blocks, pullIn]);

  return { blocks, pulling, pullError, pullIn };
}
