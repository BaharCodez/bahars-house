import { useCallback, useEffect, useState } from "react";
import type { PendingSelection, PopoverPosition } from "./selection";

/** The popover: either over a fresh selection, or over an existing mark. */
export function usePopovers() {
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openAt, setOpenAt] = useState<PopoverPosition | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const close = useCallback(() => {
    setPending(null);
    setOpenId(null);
    setOpenAt(null);
    setDraftNote("");
  }, []);

  useCloseOnEscapeOrOutside(close);

  function showSelection(selection: PendingSelection) {
    setOpenId(null);
    setDraftNote("");
    setPending(selection);
  }

  function showMark(mark: { id: string; note: string; at: PopoverPosition }) {
    setPending(null);
    setOpenId(mark.id);
    setDraftNote(mark.note);
    setOpenAt(mark.at);
  }

  return {
    pending,
    openId,
    openAt,
    draftNote,
    setDraftNote,
    close,
    showSelection,
    showMark,
  };
}

/* Escape closes it, and so does clicking anywhere off it — a popover that
   sits there until you pick something is a nag, not a prompt. Note edits
   save on blur, so closing this way never loses what you typed. */
function useCloseOnEscapeOrOutside(close: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const onPopover =
        target?.closest("[data-popover]") || target?.closest("mark[data-hl]");
      if (!onPopover) close();
    };
    window.addEventListener("keydown", onKey);
    // Capture, so it lands before a fresh selection opens the next popover.
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [close]);
}
