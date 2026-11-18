// The landing-page mind map. Read-only for now: this file is the whole truth.
// The shape (ids, labels, edges by id) mirrors what database rows would look
// like, so owner-only editing can replace this file later without redrawing.

// Logical size of the map; the landing page canvas scales it with a transform.
export const MIND_MAP_WIDTH = 1280;
export const MIND_MAP_HEIGHT = 720;

export type MapNodeKind = "core" | "topic" | "link";

export type MapNode = {
  id: string;
  label: string;
  kind: MapNodeKind;
  /** Where a click goes; topics without a page yet have none. */
  href?: string;
};

export type MapEdge = { source: string; target: string };

export const MAP_NODES: MapNode[] = [
  { id: "brain", label: "my brain", kind: "core" },
  { id: "neuroscience", label: "neuroscience", kind: "topic" },
  { id: "philosophy", label: "philosophy", kind: "topic" },
  { id: "books", label: "books", kind: "topic" },
  { id: "architecture", label: "architecture", kind: "topic" },
  { id: "cs", label: "computer science", kind: "topic" },
  { id: "biology", label: "biology", kind: "topic" },
  { id: "climbing", label: "climbing", kind: "topic" },
  { id: "astronomy", label: "astronomy", kind: "topic" },
  // The hobby board's four buckets hang off it; all of them open the board.
  {
    id: "hobby-board",
    label: "hobby board",
    kind: "topic",
    href: "/notes/board",
  },
  { id: "writing", label: "→ writing room", kind: "link", href: "/notes" },
  { id: "study", label: "→ study", kind: "link", href: "/study" },
  { id: "read", label: "read about", kind: "link", href: "/notes/board" },
  { id: "write", label: "write about", kind: "link", href: "/notes/board" },
  { id: "explore", label: "explore", kind: "link", href: "/notes/board" },
  { id: "solve", label: "solve", kind: "link", href: "/notes/board" },
];

export const MAP_EDGES: MapEdge[] = [
  { source: "brain", target: "neuroscience" },
  { source: "brain", target: "philosophy" },
  { source: "brain", target: "books" },
  { source: "brain", target: "architecture" },
  { source: "brain", target: "cs" },
  { source: "brain", target: "biology" },
  { source: "brain", target: "climbing" },
  { source: "brain", target: "astronomy" },
  { source: "astronomy", target: "philosophy" },
  { source: "brain", target: "hobby-board" },
  { source: "hobby-board", target: "read" },
  { source: "hobby-board", target: "write" },
  { source: "hobby-board", target: "explore" },
  { source: "hobby-board", target: "solve" },
  { source: "books", target: "read" },
  { source: "neuroscience", target: "philosophy" },
  { source: "neuroscience", target: "biology" },
  { source: "architecture", target: "cs" },
  { source: "books", target: "writing" },
  { source: "cs", target: "study" },
];
