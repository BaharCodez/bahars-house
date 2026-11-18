# Landing page mind map (phase 1)

## Intent

Replace the collage images around "Welcome to my Brain" with a live nodes-and-edges
graph. It later becomes Bahar's editable mind map; for now it is a read-only starter.
Why: the collage reads as basic/generic; a graph of her own interests is more personal
and techy, and is the seed of a real mind-map feature.

## Goals

- Graph of 8 nodes: "my brain" (centre) plus neuroscience, philosophy, books,
  architecture, computer science, biology, climbing.
- Two tag nodes linking out: "writing room" (/notes) and "study" (/study).
- Behaviour as in spike B: force-directed layout that settles, drag a node and it
  springs back, soft glow, mono labels, dashed edges to tag nodes.
- Node/edge data lives in one typed data file shaped like the future DB rows
  (id, label, kind, href?, edges as source/target ids) so editing can be added later
  without redrawing.

## Non-goals (this phase)

- Adding/editing/deleting nodes, database tables, owner-only API.
- Restyling the rest of the landing page (vintage/coffee/moss retheme is a separate project).
- Topic nodes opening pages (they have none yet).

## Anti-goals

- The public must never be able to change anything. No write endpoints in this phase.
- No scroll-hijacking: mouse wheel must keep scrolling the page (no wheel zoom).
- Must not look like a default library demo.

## Approaches considered

- A: hand-drawn SVG + own layout, saved in DB. Most unique, most work.
- B: d3-force library. Physics, drag for free; looks generic unless styled.
- C: fixed hard-coded graph. Quickest, no motion.
- Chosen: B (user's pick after seeing both mockups), styled by us, using only the
  `d3-force` package for the simulation (rendering and dragging in React/SVG).

## Constraints

- Next.js 16 (read node_modules/next/dist/docs before writing code); graph is a client component.
- Landing page is a fixed 1617x2800 canvas scaled with a CSS transform; drag maths must
  account for that scale.
- Respect prefers-reduced-motion (settle once, no continuous motion).
- Keep the climbing-wall column on the right clear.

## Calls made by me (change if wrong)

- Dark "monitor" panel set into the parchment page, dark moss/green palette from spike B,
  rather than recolouring the whole page.
- Graph occupies the hero area where the collage art around the headline is now; the
  collage pieces in the hero zone are removed, the about/interests/rooms sections stay as is.
- Headline "Welcome to my Brain" stays, overlaid or beside the graph.
- Touch/mobile: nodes draggable by touch; layout scales with the canvas.

## Left to the builder

Exact panel size and position, node sizes, label placement, simulation tuning, the
canvas-scale drag correction, and file layout.

---

# Phase 2: a real, editable mind map (awaiting approval)

## Intent

The landing graph becomes Bahar's actual mind map: click a node to read its detail,
and when she is signed in she can add, rename, connect and delete nodes and write notes
without touching code. Visitors can only look.

## Goals

- Click (or tap) a node: a detail panel opens beside the map with the node's title, her
  note, links out (rooms, books, posts, any URL) and its neighbours as clickable chips.
- Owner-only editing on the page: add child node, rename, edit note and links, connect
  or disconnect two nodes, delete a node, pin a node where she dragged it.
- Data in the database (new `MapNode`, `MapEdge` tables; `MapNode` holds label, kind,
  note, links as JSON, optional pinned x/y). Seeded from today's `app/lib/mindMap.ts`.

## Non-goals

- Multiple maps, sharing, real-time collaboration, rich-text/markdown notes (plain text
  with line breaks first), auto-linking to books/posts by tag.

## Anti-goals

- The public must never be able to create, change or delete anything. Every write route
  calls `requireOwner()`; reads return only what is meant to be public. Input is
  validated (length caps, link URLs restricted to http(s) or site-relative paths).
- Editing UI must not even render for visitors.

## Calls made by me

- Auto-layout stays the default; dragging only pins a node when signed in. Visitors'
  drags still spring back and are never saved.
- Detail panel replaces direct navigation: room links become buttons inside the panel.
- Follow the existing Idea board pattern (Prisma model + `app/api/.../route.ts` with
  `requireOwner`, zod validation in `app/lib/validation.ts`).

## Left to the builder

Panel layout, edit-mode affordances, migration/seed mechanics, mobile behaviour.
