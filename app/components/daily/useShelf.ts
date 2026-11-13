import { useState } from "react";
import { readJsonOrEmpty, sendJson } from "@/app/lib/daily/http";
import type { Bookmark } from "./types";

const SHELF_REFUSED = "Sign in as the owner to change the shelf.";

type BookmarkChange = Partial<Pick<Bookmark, "favorite" | "shelf">>;

export type SaveResult =
  | { ok: true; bookmark: Bookmark }
  | { ok: false; error: string };

/**
 * The saved reads, changed optimistically. A refused write rolls back and
 * leaves a note saying why (usually: not signed in as the owner).
 */
export function useShelf(initialBookmarks: Bookmark[]) {
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [note, setNote] = useState<string | null>(null);

  async function save(input: {
    url: string;
    title: string;
    source?: string;
  }): Promise<SaveResult> {
    const res = await sendJson("/api/bookmarks", "POST", input);
    if (!res.ok) {
      const data = await readJsonOrEmpty(res);
      return { ok: false, error: data.error ?? "Couldn't save that." };
    }
    const saved: Bookmark = await res.json();
    setBookmarks((s) =>
      s.some((b) => b.id === saved.id) ? s : [saved, ...s],
    );
    return { ok: true, bookmark: saved };
  }

  function applyChange(id: string, change: BookmarkChange) {
    setBookmarks((s) => s.map((b) => (b.id === id ? { ...b, ...change } : b)));
  }

  async function patch(id: string, change: BookmarkChange, undo: BookmarkChange) {
    applyChange(id, change);
    const res = await sendJson(`/api/bookmarks/${id}`, "PATCH", change);
    if (res.ok) return;
    applyChange(id, undo);
    setNote(SHELF_REFUSED);
  }

  function toggleFavorite(b: Bookmark) {
    return patch(b.id, { favorite: !b.favorite }, { favorite: b.favorite });
  }

  // "" puts it back on the catch-all.
  function moveToShelf(b: Bookmark, name: string) {
    if ((b.shelf ?? "") === name) return;
    return patch(b.id, { shelf: name }, { shelf: b.shelf });
  }

  async function remove(b: Bookmark) {
    const before = bookmarks;
    setBookmarks((s) => s.filter((x) => x.id !== b.id));
    const res = await fetch(`/api/bookmarks/${b.id}`, { method: "DELETE" });
    if (res.ok) return;
    setBookmarks(before);
    setNote(SHELF_REFUSED);
  }

  return {
    bookmarks,
    note,
    setNote,
    save,
    toggleFavorite,
    moveToShelf,
    remove,
  };
}

export type ShelfState = ReturnType<typeof useShelf>;
