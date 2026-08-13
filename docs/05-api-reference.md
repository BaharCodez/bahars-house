# 05 — API reference

23 route handlers under `app/api/`. Conventions that hold everywhere:

- **Auth:** mutating handlers begin with `const denied = await requireOwner(); if (denied) return denied;` → `401 { error: "Only the keeper of this house can change things — sign in." }`
- **Validation:** Zod, from `app/lib/validation.ts`. Failure → `400 { error: <first issue message> }` (a few return a bare 400 with no body).
- **Not found:** bare `404` with no body.
- **Deletes:** `204` with no body.
- **`params` is a Promise** — `{ params }: { params: Promise<{ id: string }> }`.

Legend: 🌐 public · 🔒 owner-only

---

## Auth

### `GET|POST /api/auth/[...nextauth]` 🌐

Auth.js handlers (sign-in, callback, session, CSRF, sign-out). Re-exported from
`app/lib/auth.ts`.

### `POST /api/signup` 🌐 — but only once

Bootstraps the owner account. **Refuses if any `User` row exists:**
`403 { error: "This house isn't handing out new keys." }`

Body (`signupSchema`): `{ name, email, password }` — email normalised to
lowercase, password ≥ 8 chars. Hashes with bcrypt cost 10.

`201 { ok: true }` · `409` if the email already exists (unreachable in practice,
since any existing user already triggers the 403).

---

## Books & the study

### `GET /api/books` 🌐

Library grid metadata. Never the file bytes.

```json
[{ "id","title","author","coverDataUrl","createdAt": 1699999999999,
   "noteCount": 3, "ownerName": "Bahar", "mine": true }]
```

`createdAt` is epoch ms. `mine` compares `ownerId` with `actorUserId()` — which
falls back to the owner, so **anonymous visitors see `mine: true`** (the delete
button renders, then the API refuses it). Ordered `createdAt desc`.

### `POST /api/books` 🔒

`multipart/form-data`: `file` (required Blob), `title`, `author`, `coverDataUrl`
(all optional strings; title/author default to "Untitled" / "Unknown author").
Reads the whole file into a Buffer and stores it in the `Book.data` column.

`201 { id, title, author, coverDataUrl }` · `400 { error: "Missing file." }`

### `GET /api/books/[id]` 🌐

Streams the raw EPUB. `Content-Type: application/epub+zip`,
`Cache-Control: private, max-age=3600`. `404` if unknown.

### `DELETE /api/books/[id]` 🔒

Also 403s unless `book.ownerId === actorUserId()`. Cascades to annotations and
progress. `204`.

### `GET /api/books/[id]/annotations` 🌐

Everyone sees everyone's notes, oldest first.

```json
[{ "id","cfiRange","text","comment","createdAt": <epoch ms>,
   "authorId","authorName","authorImage","mine": true }]
```

`authorName` falls back to `"Anonymous"`.

### `POST /api/books/[id]/annotations` 🔒

Body (`annotationInputSchema`): `{ cfiRange, text, comment? }` — `comment`
defaults `""`, max 5000. `404` if the book is unknown.
`201` with the same shape as GET, `mine: true`.

### `DELETE /api/annotations/[id]` 🔒

`403` unless the row's `userId` matches `actorUserId()`. `204`.

### `GET /api/books/[id]/progress` 🌐

`{ "cfi": "epubcfi(…)" | null }`. Returns `{cfi:null}` when there's no actor
rather than erroring.

### `PUT /api/books/[id]/progress` 🔒

Body: `{ cfi: string }` (hand-checked, not Zod). Upserts on
`@@unique([userId, bookId])`. `204` · `400 { error: "Missing cfi." }`

---

## Writing room

### `GET /api/posts` 🌐

`{ id, title, tags, coverImage, publishedAt, updatedAt }[]`, ordered
`publishedAt desc` with `nulls: "first"` — **drafts sort to the top and are
publicly readable.** Body content is not included.

### `POST /api/posts` 🔒

Body (`postInputSchema`): `{ title (≤200), content (≤100 000, default ""), tags (≤12, each ≤40), coverImage (≤500, "" → null), published (default true) }`.
`published: true` sets `publishedAt = now()`. `201 { id }`

### `GET /api/posts/[id]` 🌐

The full post row, including markdown `content`. Drafts included.

### `PATCH /api/posts/[id]` 🔒

Same full schema as POST (not a partial — send every field). Publishing an
already-published post keeps the original `publishedAt`; `published: false` sets
it back to `null`. `200 { id, publishedAt }`

### `DELETE /api/posts/[id]` 🔒

`204`.

### `POST /api/images` 🔒

`multipart/form-data`: `file`. Must be `image/*`, max **4 MB** ("keep under
serverless body limits"). `201 { id, url: "/api/images/<id>" }` ·
`400 { error: "That's not an image." | "Images need to be under 4MB." }`

### `GET /api/images/[id]` 🌐

The bytes, with the stored `mime` and
`Cache-Control: public, max-age=31536000, immutable`.

---

## Hobby board

### `GET /api/ideas` 🌐

All ideas, `createdAt asc`.

### `POST /api/ideas` 🔒

Body (`ideaInputSchema`): `{ bucket: "read"|"write"|"explore"|"solve", text (≤500) }`. `201`

### `PATCH /api/ideas/[id]` 🔒

Hand-rolled (no Zod): accepts `done: boolean` and/or `text: string` (trimmed,
sliced to 500). Sending neither is a no-op `200`, not a 400.

### `DELETE /api/ideas/[id]` 🔒

`204`.

---

## Portfolio wall & workshop shelf

### `GET /api/frames` 🌐

**All** frames including `kind: "sandbox"`, ordered `[sort asc, createdAt asc]`.
The room pages filter by kind themselves.

### `POST /api/frames` 🔒

Body (`frameInputSchema`): `{ kind: "job"|"gig"|"project"|"achievement"|"sandbox", title (≤120), subtitle (≤600), detail (≤2000), years (≤40, nullable), link (URL or ""), tags (≤12 × ≤30), sort (int) }`.
Empty-string `link`/`years` are stored as `null`. `201` with the row.

### `PATCH /api/frames/[id]` 🔒

`frameInputSchema.partial()` — send only what changes. `200` with the row.

### `DELETE /api/frames/[id]` 🔒

`204`.

---

## Daily room

### `GET /api/daily` 🌐

The latest 400 ticks: `{ kind, day }[]`, `day desc`. Powers the streak board.

### `POST /api/daily` 🔒

Body (`dailyTickSchema`): `{ kind: "article"|"spanish"|"listening", day: "YYYY-MM-DD" }`.
Upserted on `(kind, day)` — **idempotent**, always `201`.

### `GET /api/bookmarks` 🌐

Shelf cards only: `{ id, url, title, source, favorite, shelf, createdAt }`,
ordered `[favorite desc, createdAt desc]`. The cached article body is never
included.

### `POST /api/bookmarks` 🔒

Body (`bookmarkInputSchema`): `{ url (valid URL), title (≤300), source (≤120), favorite (default false), shelf (≤40, whitespace-collapsed) }`.
`201` normally; on a duplicate URL (Prisma `P2002`) it returns the **existing**
row with **`200`**.

### `PATCH /api/bookmarks/[id]` 🔒

Body (`bookmarkPatchSchema`): at least one of `{ favorite, shelf }`, else `400`
(bare). Response deliberately selects only `{ id, url, title, favorite, shelf }`.

### `DELETE /api/bookmarks/[id]` 🔒

`204`. Cascades to its highlights.

### `POST /api/bookmarks/[id]/article` 🔒

Pull the readable body into the house. Body (`articleInputSchema`), a union:

```json
{ "mode": "fetch" }
{ "mode": "paste", "text": "…" }          // ≤400 000 chars
```

`fetch` runs `fetchArticle(bookmark.url)`: HTTP(S) only, SSRF guard on private
hosts, 12 s timeout, 4 MB cap, browser-like User-Agent, then Readability +
`linkedom` → `Block[]`. `paste` splits on blank lines into paragraphs.

Persists `blocks`, `byline`, `wordCount`, `fetchedAt = now()`.
`200 { id, blocks, byline, wordCount }` ·
`422 { error }` for any `ArticleError` (unreachable page, 403 from the source,
no readable article, too big, not a web page, private address).

---

## Reading desk highlights

### `POST /api/highlights` 🔒

Body (`highlightInputSchema`): `{ bookmarkId, block (int ≥0), start (int ≥0), end (int ≥1), quote (≤2000), grasp: "got"|"half"|"lost", note (≤2000) }`.
Extra check: `end > start`, else `400 { error: "That selection is empty." }`.
`404` if the bookmark is unknown. `201` with the row.

### `PATCH /api/highlights/[id]` 🔒

Body (`highlightPatchSchema`): at least one of `{ grasp, note }`. `200` with the row.

### `DELETE /api/highlights/[id]` 🔒

`204`.

---

## Roadmaps, DSA board & LeetCode

> There is **no** endpoint to create or delete roadmaps or steps. Content is
> inserted straight into the database — see [08](08-operations.md).

### `PATCH /api/roadmap-steps/[id]` 🔒

Body (`roadmapStepPatchSchema`): at least one of `{ done: boolean, confidence: 0..3 }`.
`200 { id, done, confidence }` · bare `400` / `404`.

### `GET /api/roadmap-steps/for-book/[bookId]` 🔒-ish

Steps whose `link` contains `book=<bookId>`, with the `loc` query param pulled
out of the link: `{ id, loc, done }[]`. **Non-owners get `[]`, not a 401**, so
the reader silently skips tracking for visitors. Steps whose link has no `loc`
are filtered out.

### `PATCH /api/roadmap-steps/for-book/[bookId]` 🔒

Body: `{ doneIds: string[] }`. Sets `done: true` on those ids, **scoped to steps
whose link contains `book=<bookId>`** so a stray id can't flip a step on another
roadmap. Reading only ever ticks, never unticks. `200 { ok: true }` · bare `400`
if `doneIds` isn't a string array.

### `POST /api/problem-log` 🔒

Log a drilled problem. Body (`problemLogSchema`):
`{ url, name, pattern, status?: "solved"|"struggled"|"clear", rating?: 0..5, note?: ≤4000 }`
— at least one of `status`/`rating`/`note`.

- `status: "clear"` → `deleteMany({ url })`, `204`.
- Upsert keyed on `url`. On update, only the fields actually sent are written, so
  writing a note leaves the verdict alone.
- **Any explicit `status` sets `auto: false`** — a hand-set verdict stops being
  the sync's to overwrite.
- New row with no `status` → `400 { error: "Mark it solved or struggled first." }`

`200` with the row.

### `POST /api/leetcode` 🔒

Link a LeetCode account. Body (`leetcodeUsernameSchema`):
`{ username }` — `[A-Za-z0-9_.-]`, ≤39 chars, handle not URL. Verified against
LeetCode's public GraphQL (`matchedUser`) before saving, and saved in LeetCode's
own spelling into `Setting["leetcode.username"]`.

`200 { username }` · `422 { error }` (typo, private profile, LeetCode
unreachable) · `400` on schema failure.

### `DELETE /api/leetcode` 🔒

Clears `leetcode.username` and `leetcode.syncedAt`. Already-logged problems stay
— "they were still solved." `204`.

### `POST /api/leetcode/sync` 🔒

Pulls `recentAcSubmissionList` (limit **20** — LeetCode's own ceiling, so this
syncs forward, it can't backfill), intersects it with
`problemsBySlug()` (every problem in `app/lib/dsaContent.ts`), and
`createMany({ skipDuplicates: true })`s the ones not already logged, as
`status: "solved", auto: true`. Existing rows are never touched.

```json
{ "username": "…", "syncedAt": "2026-08-13T…Z",
  "added": [{ "url","name","pattern" }],
  "offBoard": 7 }
```

`offBoard` = recent solves that aren't on the board at all — context for "I
solved loads and nothing moved."

`400 { error: "No LeetCode account linked yet." }` · `422 { error }` on LeetCode errors.

---

## Analytics

### `POST /api/track` 🌐

Body: `{ path?: string, ref?: string }` (path sliced to 200 chars; `ref` reduced
to its hostname minus `www.`). Adds a `Visit` row with geo from Vercel headers,
a sniffed device string, and a salted 16-char `ipHash`.

**Returns `204` and writes nothing if the caller is the owner.** Always `204`.

Called from `VisitTracker` (mounted in the root layout) on every pathname change,
with `keepalive: true` and errors swallowed.

---

## Endpoint → caller map

| Endpoint                                                | Called from                                              |
| ------------------------------------------------------- | -------------------------------------------------------- |
| books, annotations, progress, roadmap-steps/for-book    | `app/lib/api.ts`, used by `ReaderApp.tsx` / `Reader.tsx` |
| `/api/signup`                                           | `AuthForm.tsx`                                           |
| `/api/posts*`, `/api/images`                            | `PostEditor.tsx`, `CoverPicker.tsx`                      |
| `/api/ideas*`                                           | `IdeaBoard.tsx`                                          |
| `/api/frames*`                                          | `HallwayWall.tsx`, `WorkshopShelf.tsx`                   |
| `/api/daily`, `/api/bookmarks*`, `/api/highlights/[id]` | `DailyRoom.tsx`                                          |
| `/api/bookmarks/[id]/article`, `/api/highlights*`       | `ArticleReader.tsx`                                      |
| `/api/roadmap-steps/[id]`, `/api/problem-log`           | `RoadmapView.tsx`                                        |
| `/api/leetcode`, `/api/leetcode/sync`                   | `LeetCodeSync.tsx` (inside `DsaStrengthBoard`)           |
| `/api/track`                                            | `VisitTracker.tsx`                                       |
