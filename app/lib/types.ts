// Shared client/server shapes for the reading app.

export interface CurrentUser {
  id: string;
  name: string;
}

// A book as shown in the library grid (no file blob).
export interface BookMeta {
  id: string;
  title: string;
  author: string;
  coverDataUrl?: string | null;
  createdAt: number;
  noteCount: number;
  // Who added the book to the shared library.
  ownerName: string;
  // True when the signed-in user added it (so only they can remove it).
  mine: boolean;
}

// A margin note as returned by the API — carries who wrote it.
// What kind of passage a mark is. Books categorise by *what a passage is*;
// the daily room's article highlights categorise by how well you grasped it.
export type AnnotationKind = "idea" | "definition" | "example" | "question";

export interface Annotation {
  id: string;
  cfiRange: string;
  text: string;
  comment: string;
  kind: AnnotationKind;
  createdAt: number;
  authorId: string;
  authorName: string;
  authorImage?: string | null;
  // True when the signed-in user wrote it (so the UI can offer delete).
  mine: boolean;
}

export interface AnnotationInput {
  cfiRange: string;
  text: string;
  comment: string;
  kind: AnnotationKind;
}
