// The landing-page mind map: shared types and the starter map.
// The live map is stored in the database (MapNode / MapEdge). Until the owner
// saves it there, and whenever the database can't be reached, the page falls
// back to the starter map below, so the landing page always renders.

// Logical size of the map; the landing page canvas scales it with a transform.
export const MIND_MAP_WIDTH = 1280;
export const MIND_MAP_HEIGHT = 720;

export type MapNodeKind = "core" | "topic" | "link";

export type MapLink = { label: string; href: string };

export type MapNode = {
  id: string;
  label: string;
  kind: MapNodeKind;
  /** The owner's own words about this topic. Plain text. */
  note: string;
  /** Where to go from here: rooms, books, posts, any URL. */
  links: MapLink[];
  /** Set when the owner has dragged this node and left it there. */
  pinned: { x: number; y: number } | null;
};

export type MapEdge = { id: string; source: string; target: string };

export type MindMapData = { nodes: MapNode[]; edges: MapEdge[] };

const node = (
  id: string,
  label: string,
  kind: MapNodeKind,
  links: MapLink[] = [],
): MapNode => ({ id, label, kind, note: "", links, pinned: null });

const BOARD: MapLink[] = [
  { label: "Open the hobby board", href: "/notes/board" },
];

export const STARTER_NODES: MapNode[] = [
  node("brain", "my brain", "core"),
  node("neuroscience", "neuroscience", "topic"),
  node("philosophy", "philosophy", "topic"),
  node("books", "books", "topic"),
  node("architecture", "architecture", "topic"),
  node("cs", "computer science", "topic"),
  node("biology", "biology", "topic"),
  node("climbing", "climbing", "topic"),
  node("astronomy", "astronomy", "topic"),
  node("hobby-board", "hobby board", "topic", BOARD),
  node("writing", "writing room", "link", [
    { label: "Open the writing room", href: "/notes" },
  ]),
  node("study", "study", "link", [{ label: "Open the study", href: "/study" }]),
  node("read", "read about", "link", BOARD),
  node("write", "write about", "link", BOARD),
  node("explore", "explore", "link", BOARD),
  node("solve", "solve", "link", BOARD),
];

const PAIRS: [string, string][] = [
  ["brain", "neuroscience"],
  ["brain", "philosophy"],
  ["brain", "books"],
  ["brain", "architecture"],
  ["brain", "cs"],
  ["brain", "biology"],
  ["brain", "climbing"],
  ["brain", "astronomy"],
  ["astronomy", "philosophy"],
  ["brain", "hobby-board"],
  ["hobby-board", "read"],
  ["hobby-board", "write"],
  ["hobby-board", "explore"],
  ["hobby-board", "solve"],
  ["books", "read"],
  ["neuroscience", "philosophy"],
  ["neuroscience", "biology"],
  ["architecture", "cs"],
  ["books", "writing"],
  ["cs", "study"],
];

export const STARTER_EDGES: MapEdge[] = PAIRS.map(([source, target]) => ({
  id: `${source}-${target}`,
  source,
  target,
}));

export const STARTER_MAP: MindMapData = {
  nodes: STARTER_NODES,
  edges: STARTER_EDGES,
};
