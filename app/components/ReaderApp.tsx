"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import UploadDropzone from "./UploadDropzone";
import Library from "./Library";
import Reader from "./Reader";
import {
  deleteBook,
  fetchBooks,
  bookFileUrl,
  updateBookMetadata,
  uploadBook,
} from "@/app/lib/api";
import { parseBookMetadata } from "@/app/lib/epub";
import type { BookMeta, CurrentUser } from "@/app/lib/types";

// `currentUser` is null for visitors: the shelf and the books are public.
export default function ReaderApp({
  currentUser,
  canManageBooks,
}: {
  currentUser: CurrentUser | null;
  canManageBooks: boolean;
}) {
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // A section to open at (EPUB href), from a `?loc=` deep link — e.g. a
  // roadmap step that jumps straight to its chapter. One-shot: cleared once
  // opened, and dropped whenever a different book is chosen from the shelf.
  const [openLoc, setOpenLoc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the initial book-restore has run, so the URL-sync effect doesn't
  // clear the saved book on the first render.
  const restored = useRef(false);

  const refresh = useCallback(async () => {
    setBooks(await fetchBooks());
  }, []);

  // Load the library and honor a ?book=<id> share link on first paint.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await fetchBooks();
        if (active) setBooks(list);
        if (canManageBooks) {
          for (const book of list) {
            if (book.author !== "Unknown author" && book.coverDataUrl) continue;
            try {
              const response = await fetch(bookFileUrl(book.id));
              if (!response.ok) continue;
              const meta = await parseBookMetadata(
                await response.arrayBuffer(),
              );
              const patch = {
                ...(book.author === "Unknown author" && meta.author
                  ? { author: meta.author }
                  : {}),
                ...(meta.coverDataUrl && !book.coverDataUrl
                  ? { coverDataUrl: meta.coverDataUrl }
                  : {}),
              };
              if (Object.keys(patch).length) {
                await updateBookMetadata(book.id, patch);
              }
            } catch (error) {
              console.warn("Couldn't repair book metadata.", error);
            }
          }
          if (active) setBooks(await fetchBooks());
        }
      } catch {
        if (active) setBooks([]);
      }
      // Reopen the book from a share link, or the last one you were reading.
      const params = new URLSearchParams(window.location.search);
      const savedBookKey = currentUser ? `lastBook:${currentUser.id}` : null;
      const shared =
        params.get("book") ??
        (savedBookKey ? localStorage.getItem(savedBookKey) : null);
      if (shared && active) {
        // Honor `?loc=` only when it comes with an explicit `?book=` link.
        if (params.get("book")) setOpenLoc(params.get("loc"));
        setOpenId(shared);
      }
      restored.current = true;
    })();
    return () => {
      active = false;
    };
  }, [canManageBooks, currentUser]);

  // Keep the URL in sync so the current book is always shareable. Guarded so
  // it can't wipe the saved book before the restore above has run.
  useEffect(() => {
    if (!restored.current) return;
    const url = new URL(window.location.href);
    if (openId) {
      url.searchParams.set("book", openId);
      if (currentUser) {
        localStorage.setItem(`lastBook:${currentUser.id}`, openId);
      }
    } else {
      url.searchParams.delete("book");
      if (currentUser) {
        localStorage.removeItem(`lastBook:${currentUser.id}`);
      }
    }
    // `loc` is a one-shot jump — keep the shareable URL down to just `?book=`.
    url.searchParams.delete("loc");
    window.history.replaceState(null, "", url);
  }, [currentUser, openId]);

  const addBook = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".epub")) {
        setError("That doesn't look like an EPUB file. Please choose a .epub.");
        return;
      }
      setError(null);
      setBusy(true);
      try {
        // Read the file once into memory; mobile (iCloud) file handles can go
        // stale between reads, so reuse these bytes for both parsing and upload.
        // Retry a few times — iOS may still be downloading an iCloud file.
        let data: ArrayBuffer | null = null;
        for (let attempt = 0; attempt < 3 && data === null; attempt++) {
          try {
            data = await file.arrayBuffer();
          } catch (err) {
            if (attempt === 2) {
              console.warn(
                "Couldn't read file into memory; uploading raw.",
                err,
              );
            } else {
              await new Promise((r) => setTimeout(r, 700));
            }
          }
        }

        // Metadata parsing is best-effort — fall back to the filename, since the
        // reader reads the real title from the book on open.
        let meta = {
          title: file.name.replace(/\.epub$/i, ""),
          author: "Unknown author",
        };
        if (data) {
          try {
            meta = await parseBookMetadata(data);
          } catch (err) {
            console.warn("Couldn't read EPUB metadata; using filename.", err);
          }
        }

        const payload = data
          ? new Blob([data], { type: "application/epub+zip" })
          : file;
        const { id } = await uploadBook(payload, meta);
        await refresh();
        setOpenLoc(null);
        setOpenId(id);
      } catch (e) {
        setError("Couldn't add this EPUB. Please try again.");
        console.error(e);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const removeBook = useCallback(
    async (id: string) => {
      await deleteBook(id);
      await refresh();
    },
    [refresh],
  );

  if (openId) {
    return (
      <Reader
        bookId={openId}
        initialLoc={openLoc ?? undefined}
        onClose={() => {
          setOpenLoc(null);
          setOpenId(null);
        }}
      />
    );
  }

  if (books === null) {
    return (
      <p className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading your library…
      </p>
    );
  }

  if (books.length === 0) {
    return (
      <UploadDropzone
        busy={busy}
        error={error}
        userName={currentUser?.name ?? "friend"}
        canManageBooks={canManageBooks}
        onFile={addBook}
      />
    );
  }

  return (
    <Library
      books={books}
      busy={busy}
      error={error}
      userName={currentUser?.name ?? null}
      canManageBooks={canManageBooks}
      onFile={addBook}
      onOpen={(id) => {
        setOpenLoc(null);
        setOpenId(id);
      }}
      onDelete={removeBook}
    />
  );
}
