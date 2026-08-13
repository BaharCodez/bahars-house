# Bahar's House — engineering documentation

Everything a developer needs to run, change, and operate this codebase.
Written against the code as it exists on branch `reading-desk-and-dsa-board`
(latest commit `907c45c`).

## What this project actually is

The repo is still _named_ `social-reading-app` and the git history starts as
"The Same Page", a multi-user EPUB reading app. It has since been rebuilt into
**bahar's house**: a single-owner personal site laid out as rooms of a house
(portfolio, writing room, study/bookshelf, daily room, roadmaps, workshop).

The multi-user reading machinery (users, shared annotations, per-user reading
progress) is still in the schema and still works, but the product on top of it
is single-owner: **the public may look at everything, and may never change
anything.** That rule is enforced in one place — see
[03 — Auth & access control](03-auth-and-access-control.md) — and it is the
single most important invariant in the codebase (`CLAUDE.md` states it too).

## Read in this order

| Doc                                                         | What's in it                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [01 — Setup & installation](01-setup.md)                    | Prerequisites, env vars, database bootstrap, dev server, LAN/phone testing, troubleshooting                        |
| [02 — Architecture](02-architecture.md)                     | Next.js 16 App Router layout, rendering strategy, server/client split, Prisma client generation, request lifecycle |
| [03 — Auth & access control](03-auth-and-access-control.md) | Auth.js 5 setup, the owner model, `requireOwner()`, what's public vs private, the closed signup door               |
| [04 — Data model](04-data-model.md)                         | Every Prisma model, field-by-field, with the semantics the schema comments imply                                   |
| [05 — API reference](05-api-reference.md)                   | Every route handler: method, auth, request body, responses, quirks                                                 |
| [06 — UI, theming & components](06-ui-and-styling.md)       | Room shells, the theme system, CSS custom properties, fonts, component inventory                                   |
| [07 — Feature deep dives](07-features.md)                   | EPUB reader, reading desk, roadmaps + DSA board + LeetCode sync, daily room, writing room, visitors                |
| [08 — Operations](08-operations.md)                         | CI, deployment, schema changes, seeding data that has no UI, backups                                               |
| [09 — Gotchas & known issues](09-gotchas.md)                | Dead code, sharp edges, things that will bite you                                                                  |

## Sixty-second orientation

```
app/
  layout.tsx          root layout: fonts, theme bootstrap, Sidebar, VisitTracker, SecretDoor
  page.tsx            "/" — the hallway (landing page, room cards)
  globals.css         Tailwind 4 entry + all 7 themes + every custom animation
  hallway/            "/hallway" — portfolio wall (Frame rows, kind != "sandbox")
  notes/              writing room: index, [id] reader, write/ editor, board/ (sticky notes)
  study/              the bookshelf + EPUB reader (client-heavy)
  daily/              daily room; daily/read/[id] is the article reading desk
  roadmaps/           owner-only learning paths; [slug] renders steps + DSA board
  workshop/           ESP32 mission-control placeholder + sandbox project shelf
  visitors/           owner-only analytics (Konami code opens it)
  login/, signup/     Auth.js credential + Google sign-in
  api/**/route.ts     23 route handlers — the entire write surface
  components/         28 components; all but RoomShell/RoomBanner are client components
  lib/                server helpers (prisma, session, article, feeds, leetcode, settings)
                      + shared pure logic (validation, dsaStrength, reading, themes)
  generated/prisma/   Prisma client output — GENERATED, gitignored, never edit
prisma/schema.prisma  20 models, Postgres, no migrations directory (see 08)
```

Nothing writes to the database unless `requireOwner()` says yes (exceptions:
`/api/signup` on an empty database, and `/api/track` which logs visits).
