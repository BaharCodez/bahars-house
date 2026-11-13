import type { Grasp } from "@/app/lib/daily/highlights";

// Mirror of the server-side DailyArticle shape (feeds.ts is server-only).
export interface DailyArticle {
  source: string;
  title: string;
  url: string;
}

export type TickKind = "article" | "spanish" | "listening";

export interface TickControl {
  done: boolean;
  busy: boolean;
  onTick: () => void;
}

export interface Tick {
  kind: string;
  day: string;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  source: string;
  favorite: boolean;
  // Which shelf it sits on; "" is the catch-all.
  shelf: string;
  // True once the article's body has been pulled in and can be read here.
  pulledIn?: boolean;
}

// A passage marked up on the reading desk that didn't fully land.
export interface FuzzyMark {
  id: string;
  quote: string;
  note: string;
  grasp: Grasp;
  bookmarkId: string;
  bookmarkTitle: string;
}

export interface ReaderBookmark {
  id: string;
  url: string;
  title: string;
  source: string;
  byline: string;
  wordCount: number;
}
