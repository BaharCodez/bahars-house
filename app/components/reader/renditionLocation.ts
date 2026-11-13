import type { Book, Rendition } from "epubjs";

export interface ReadingProgress {
  page: number;
  total: number;
}

export function currentCfi(rendition: Rendition): string | undefined {
  const location = rendition.currentLocation() as
    | { start?: { cfi?: string } }
    | undefined;
  return location?.start?.cfi;
}

// "Page X of Y", derived from epub.js locations. Undefined until the
// locations have been generated.
export function readingProgressAt(
  book: Book,
  cfi: string,
): ReadingProgress | undefined {
  const total = book.locations.length();
  if (!total) return undefined;
  const index = book.locations.locationFromCfi(cfi) as unknown as number;
  return { page: (index ?? 0) + 1, total };
}
