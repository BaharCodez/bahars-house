// Thin client for the reading API. All calls hit same-origin route handlers
// that authorize against the signed-in session.

import type {
  Annotation,
  AnnotationInput,
  AnnotationKind,
  BookMeta,
} from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// --- Books ---------------------------------------------------------------

export async function fetchBooks(): Promise<BookMeta[]> {
  return json<BookMeta[]>(await fetch("/api/books"));
}

export async function uploadBook(
  file: Blob,
  meta: { title: string; author: string; coverDataUrl?: string },
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", meta.title);
  form.append("author", meta.author);
  if (meta.coverDataUrl) form.append("coverDataUrl", meta.coverDataUrl);
  return json<{ id: string }>(
    await fetch("/api/books", { method: "POST", body: form }),
  );
}

export async function deleteBook(id: string): Promise<void> {
  const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Couldn't delete book.");
}

export async function updateBookMetadata(
  id: string,
  meta: { title?: string; author?: string; coverDataUrl?: string },
): Promise<void> {
  const res = await fetch(`/api/books/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  if (!res.ok) throw new Error("Couldn't update book metadata.");
}

// URL the reader fetches the raw EPUB bytes from.
export function bookFileUrl(id: string): string {
  return `/api/books/${id}`;
}

// --- Annotations ---------------------------------------------------------

export async function fetchAnnotations(bookId: string): Promise<Annotation[]> {
  return json<Annotation[]>(await fetch(`/api/books/${bookId}/annotations`));
}

export async function createAnnotation(
  bookId: string,
  input: AnnotationInput,
): Promise<Annotation> {
  return json<Annotation>(
    await fetch(`/api/books/${bookId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

// Re-categorise a mark, or write its note, after the fact.
export async function patchAnnotation(
  id: string,
  patch: { kind?: AnnotationKind; comment?: string },
): Promise<Annotation> {
  return json<Annotation>(
    await fetch(`/api/annotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteAnnotation(id: string): Promise<void> {
  const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204)
    throw new Error("Couldn't delete annotation.");
}

// --- Reading progress (per user, synced across devices) ------------------

export async function fetchProgress(bookId: string): Promise<string | null> {
  const res = await fetch(`/api/books/${bookId}/progress`);
  if (!res.ok) return null;
  const data = (await res.json()) as { cfi: string | null };
  return data.cfi;
}

export async function saveProgress(bookId: string, cfi: string): Promise<void> {
  await fetch(`/api/books/${bookId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cfi }),
  }).catch(() => {});
}

// --- Roadmap reading sync ------------------------------------------------
// Owner-only: reading a book auto-ticks the roadmap steps that link into it.

export type RoadmapReadingStep = { id: string; loc: string; done: boolean };

// Steps whose link points into this book. Empty for visitors (the API gates
// on the owner), so the reader silently skips tracking for everyone else.
export async function fetchRoadmapStepsForBook(
  bookId: string,
): Promise<RoadmapReadingStep[]> {
  try {
    const res = await fetch(`/api/roadmap-steps/for-book/${bookId}`);
    if (!res.ok) return [];
    return (await res.json()) as RoadmapReadingStep[];
  } catch {
    return [];
  }
}

export async function markRoadmapStepsRead(
  bookId: string,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  await fetch(`/api/roadmap-steps/for-book/${bookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doneIds: ids }),
  }).catch(() => {});
}
