# 09 — Gotchas & known issues

Nothing here is broken-in-production; these are the things that will surprise you.

## Will bite you while developing

### `await connection()` is load-bearing

Any page that reads Prisma **must** call `await connection()` (from
`next/server`) or `npm run build` fails in CI, which has no database. Existing
pages all do. Copy the pattern.

### `params` / `searchParams` are Promises

`const { id } = await params;` in both pages and route handlers. `tsconfig.json`
includes `.next/types/**`, so a wrong signature fails `tsc`, not just runtime.

### The Prisma client is generated, not committed

`app/generated/prisma/` is gitignored. Fresh clone, deleted `node_modules`, or a
schema edit → `npx prisma generate`. `postinstall` and `build` do it for you.

### `allowedDevOrigins` is a hardcoded IP

`next.config.ts` pins `["10.6.60.173"]`. On a different network, dev resources
(HMR, chunks) are blocked for LAN devices until you change it.

### `OWNER_EMAIL` unset means "oldest account wins"

There are 6 users in production. Without `OWNER_EMAIL`, ownership silently
depends on `User.createdAt` ordering. Always set it explicitly.

### Renaming a DSA step title breaks three joins at once

`RoadmapStep.title` is the key for `app/lib/dsaContent.ts` (templates,
visualisations, problem lists) **and** for `ProblemLog.pattern` (history). A
rename detaches all of it, silently. Rename in the database, in `dsaContent.ts`,
and in existing `ProblemLog.pattern` values together.

### `PATCH /api/posts/[id]` takes the full schema, not a partial

Unlike `/api/frames/[id]` (which uses `.partial()`), the post PATCH validates
with the complete `postInputSchema`. Send every field or `title` fails
validation.

### Two different reading-speed constants

`app/lib/reading.ts` uses 200 wpm for posts; `readingMinutes()` in
`app/lib/article.ts` uses 220 wpm for articles. Intentional-looking but
inconsistent — don't "fix" one and assume the other followed.

## Dead code

| What                                                                   | Size      | Notes                                                                                                                                                                                                             |
| ---------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/DenGame.tsx`                                           | 712 lines | The removed "den" room's walkable pixel game. Nothing imports it. It still imports the `Frame` type from `HallwayWall`, so it type-checks and lints along with everything else                                    |
| `app/components/IntruderAlarm.tsx`                                     | 94 lines  | Also from the den era; unused                                                                                                                                                                                     |
| `@tiptap/*` (7 packages)                                               | —         | Installed and in `package.json`, **imported nowhere**. `PostEditor` is a plain markdown textarea. Presumably an abandoned rich-text attempt                                                                       |
| `epubjs` "social" features                                             | —         | `Annotation.userId`, `ReadingProgress.userId`, `mine`/`authorName` fields and 5-second annotation polling are all from the multi-user "The Same Page" era. Harmless, and correct if it ever goes multi-user again |
| `Session` / `VerificationToken` tables                                 | —         | Required by the Auth.js adapter shape; never written, because sessions are JWT                                                                                                                                    |
| `dev.db`                                                               | 4.4 MB    | Pre-Postgres SQLite file at the repo root                                                                                                                                                                         |
| `public/next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` | —         | create-next-app leftovers                                                                                                                                                                                         |
| Den-era CSS                                                            | —         | `walk-bob`, `firefly`, `steam-rise` keyframes only serve `DenGame`                                                                                                                                                |

Deleting `DenGame`/`IntruderAlarm` is safe (grep first — `DenGame` is the only
importer of a couple of things).

## Design decisions that look like bugs

### `mine: true` for anonymous visitors

`GET /api/books` compares `ownerId` against `actorUserId()`, which falls back to
the owner for anonymous callers. So a visitor's library grid shows delete
buttons — which the API then refuses with 401. Cosmetic, and the security
boundary holds. If it bothers you, compare against `currentUserId()` instead in
that one response mapping.

### Drafts are publicly readable

`GET /api/posts` and `GET /api/posts/[id]` return posts with
`publishedAt: null`, and `/notes/[id]` renders them. The room labels them
"draft" and links their cards to the editor, but the content is not private.
If drafts should be owner-only, gate those two handlers and the page with
`isOwner()`.

### `/roadmaps` and `/visitors` 404 instead of 401

Deliberate — a 404 doesn't advertise that the room exists.

### Same-URL bookmark returns 200, not 201

`POST /api/bookmarks` catches Prisma `P2002` and hands back the existing row with
`200`. Client code that only treats `201` as success will mis-report a re-shelve.

### `PATCH /api/ideas/[id]` with an empty body succeeds

It hand-rolls its validation and applies whatever subset it recognises; nothing
is a 400.

## Scaling limits (fine now, real later)

### Blobs in Postgres

`Book.data` holds entire EPUB files and `Image.data` holds every post image. The
schema comment says "revisit for large libraries" and that's still pending. With
3 books and a handful of images this is a non-issue; at scale it inflates the
database, every backup, and every `GET /api/books/[id]` (which reads the whole
row into memory as a `Uint8Array`). The eventual fix is object storage
(Vercel Blob / S3) with a URL column.

Also: `POST /api/images` caps uploads at 4 MB explicitly "to stay under
serverless body limits". `POST /api/books` has **no size cap** — a large EPUB can
exceed the platform request-body limit and fail opaquely.

### Unbounded reads

- `app/notes/page.tsx` loads **every** post _including full markdown content_ to
  compute tag counts and read times, then paginates in memory.
- `postTagCounts()` loads every post's tags on the editor page.
- `/api/frames`, `/api/ideas`, `/api/bookmarks` have no pagination.
- `/api/daily` and `/visitors` do cap (400 ticks, 120 visits).

At current row counts (5 posts, 12 frames, 87 visits) none of this matters.

### Orphaned images

Nothing deletes `Image` rows. Removing a post or swapping its cover leaves the
bytes behind forever, and no reference count exists to find them by.

## External dependencies that can break silently

| Dependency                             | Failure mode                                                                                                                                                                      | Handling                                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unsplash hot-links**                 | Every room banner and several headers load `images.unsplash.com` URLs directly (`?w=1200&h=400&fit=crop`). If Unsplash changes a photo id or blocks hot-linking, banners go blank | None. Also means the site isn't fully self-hosted. `<img>` is used with an eslint-disable rather than `next/image`, so there's no optimisation or fallback |
| **RSS feeds** (8 sources)              | A feed dies or changes format                                                                                                                                                     | `Promise.allSettled` + a 6 s timeout; a dead feed contributes nothing. `articleOfTheDay` returns `null` if all fail, and the page catches that             |
| **LeetCode GraphQL**                   | Unofficial, unauthenticated, undocumented. Could change shape or start requiring auth at any time                                                                                 | `LeetCodeError` → 422 with a readable message. The `Referer` header is mandatory today                                                                     |
| **`recentAcSubmissionList` limit ~20** | The sync cannot backfill history, only move forward                                                                                                                               | Documented in the code; `offBoard` in the response explains "I solved loads and nothing moved"                                                             |
| **Article fetching**                   | Sites serve stubs, 403s, or paywalls to non-browsers                                                                                                                              | Browser-like UA, and a paste fallback with a message that says to use it                                                                                   |

## Security notes (all currently sound)

- `dangerouslySetInnerHTML` renders `marked` output for posts. Safe **because the
  owner is the only author** — `POST/PATCH /api/posts` is owner-only. If posting
  ever opens up, add sanitisation (e.g. DOMPurify or `marked` + a sanitizer).
- The article pipeline never renders fetched HTML — it flattens to plain text
  blocks, explicitly so third-party markup is never trusted.
- `fetchArticle` has an SSRF allowlist-by-exclusion (`isPrivateHost`) even though
  the endpoint is owner-only, because "read this URL" should never be a way to
  knock on the machine's own doors. It checks the **hostname**, not resolved IPs,
  so a DNS name that resolves to a private address would still be fetched — an
  acceptable residual risk for an owner-only endpoint.
- No raw IPs are stored; `ipHash` is `sha256(ip + AUTH_SECRET)` truncated to 16
  hex chars.
- No rate limiting anywhere. `POST /api/track` is public and unthrottled, so
  `Visit` rows are the one table a stranger can grow. Worth watching if the site
  gets attention.
- `bcrypt` cost 10 for the credentials path.

## Things that simply don't exist

- **No tests.** No runner, no fixtures, no CI test step.
- **No error boundaries** — no `error.tsx`, `not-found.tsx`, or `loading.tsx`
  anywhere, so failures fall through to Next's defaults.
- **No structured logging or monitoring.** A few `console.warn`/`console.error`
  calls in the reader's upload path; that's it.
- **No rate limiting, no caching layer** beyond `next: { revalidate: 3600 }` on
  feed fetches and HTTP cache headers on `/api/books/[id]` and `/api/images/[id]`.
- **No `prisma/migrations/`** — see [08](08-operations.md).
- **No `vercel.json`, no `tailwind.config.js`, no `scripts/`.**
