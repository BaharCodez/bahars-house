# 04 — Data model

Source of truth: `prisma/schema.prisma`. Provider `postgresql`, generator
`prisma-client` with `output = "../app/generated/prisma"`. **The datasource block
has no `url`** — Prisma 7 connects through the `PrismaPg` driver adapter in
`app/lib/prisma.ts`, and the CLI gets the URL from `prisma.config.ts`.

20 models, in four groups.

## Group 1 — Auth.js (`User`, `Account`, `Session`, `VerificationToken`)

Standard Auth.js adapter shape, plus one addition.

### `User`

| Field                                     | Type                          | Notes                                                                                                      |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                                      | `String @id @default(cuid())` |                                                                                                            |
| `name`, `email`, `emailVerified`, `image` | nullable                      | `email` is `@unique`; the owner check keys off it                                                          |
| `passwordHash`                            | `String?`                     | **Non-standard addition.** Set only for credentials accounts; `null` for OAuth-only users. bcrypt, cost 10 |
| `createdAt`                               | `DateTime @default(now())`    | Used by the "oldest account is the owner" fallback and by `actorUserId()`                                  |
| relations                                 |                               | `accounts`, `sessions`, `books`, `annotations`, `progress` — all cascade on user delete                    |

### `Account` / `Session` / `VerificationToken`

Untouched Auth.js shapes. Because the app uses `strategy: "jwt"`, `Session`
rows are never created — it exists to satisfy the adapter. `Account` _is_ used:
the Prisma adapter writes a row on Google sign-in.

## Group 2 — Reading / EPUB (`Book`, `Annotation`, `ReadingProgress`)

### `Book`

| Field             | Type      | Notes                                                                                                                                                             |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `author` | `String`  | Parsed client-side from the EPUB before upload; falls back to filename / "Unknown author"                                                                         |
| `coverDataUrl`    | `String?` | A base64 data URL extracted client-side                                                                                                                           |
| `data`            | `Bytes`   | **The whole EPUB file, in the database.** Schema comment: "Fine in SQLite for now; revisit for large libraries." Still true on Postgres — see [09](09-gotchas.md) |
| `ownerId`         | `String`  | → `User`, cascade delete                                                                                                                                          |
| relations         |           | `annotations`, `progress`                                                                                                                                         |

Served by `GET /api/books/[id]` as `application/epub+zip`.

### `Annotation`

A margin note anchored to an EPUB CFI range.

| Field               | Notes                                                               |
| ------------------- | ------------------------------------------------------------------- |
| `bookId`, `userId`  | both cascade                                                        |
| `cfiRange`          | epub.js CFI range string — the anchor                               |
| `text`              | the highlighted passage, denormalised so notes survive re-rendering |
| `comment`           | may be `""` (`annotationInputSchema` defaults it, max 5000)         |
| `@@index([bookId])` |                                                                     |

### `ReadingProgress`

`@@unique([userId, bookId])`, holds a single `cfi` per user per book, upserted by
`PUT /api/books/[id]/progress`. This is the "synced across devices" feature.

## Group 3 — The house

### `Post` — writing room

| Field                     | Notes                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `content`        | `content` is **markdown**, rendered with `marked` at read time (max 100 000 chars)                                                                      |
| `tags`                    | `String[] @default([])`. Freeform; `tagsSchema` trims, dedupes case-insensitively, caps each at 40 chars and the array at 12                            |
| `coverImage`              | `String?` — usually a `/api/images/<id>` path, already cropped by `CoverPicker`. When null the card falls back to the first markdown image in the body  |
| `publishedAt`             | `DateTime?` — **`null` means draft.** Drafts are still publicly readable via the API; they're just labelled "draft" and sorted first (`nulls: "first"`) |
| `createdAt` / `updatedAt` | `updatedAt` is `@updatedAt`                                                                                                                             |

Re-publishing keeps the original `publishedAt` (`existing.publishedAt ?? new Date()`).

Tag conventions live in code, not the schema: `EVERGREEN_TAGS = new Set(["learning"])`
in `app/notes/page.tsx` sinks those posts below the dated essays.

### `Image`

`mime` + `data: Bytes` + `createdAt`. Uploaded via `POST /api/images` (4 MB cap,
must be `image/*`), served immutable-cached from `GET /api/images/[id]`. Images
are never deleted, and nothing tracks which post references which image.

### `Idea` — the hobby board (`/notes/board`)

`bucket` is a **string, not an enum**: `"read" | "write" | "explore" | "solve"`,
enforced only by `ideaInputSchema`. Plus `text` (≤500), `done`, `createdAt`.

### `Frame` — portfolio wall + workshop shelf

One model, two rooms, split by `kind`:

| `kind`                                         | Where it renders                                 |
| ---------------------------------------------- | ------------------------------------------------ |
| `"job"`, `"gig"`, `"project"`, `"achievement"` | `/hallway` (query is `kind: { not: "sandbox" }`) |
| `"sandbox"`                                    | `/workshop` shelf ("projects built without AI")  |

Fields: `title`, `subtitle`, `detail`, `years` (freeform: "2023–now", "summer
2024"), `link`, `tags: String[]`, `sort: Int @default(0)`, `createdAt`.
Ordering is `[{ sort: "asc" }, { createdAt: "asc" }]`. `kind` is validated by
`frameInputSchema`'s enum — note the enum has five values while the schema
comment lists three.

### `Bookmark` — the daily room's article shelf

| Field                                        | Notes                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `url`                                        | `@unique`. Re-shelving the same URL returns the existing row with **200 instead of 201** (P2002 caught in the handler)               |
| `title`, `source`                            | shown on the card                                                                                                                    |
| `favorite`                                   | lifts it into the "special pile"; sorting is `[favorite desc, createdAt desc]`                                                       |
| `shelf`                                      | freeform shelf name, `""` = the catch-all shelf                                                                                      |
| `byline`, `blocks`, `wordCount`, `fetchedAt` | **the cached article body.** `blocks` is `Json?` holding `Block[]` from `app/lib/article.ts`; `fetchedAt` non-null means "pulled in" |

`blocks`/`byline`/`wordCount` are **deliberately excluded** from every public
response (`SHELF_FIELDS` in `app/api/bookmarks/route.ts`) — it's a private cache
of someone else's writing.

### `Highlight` — marks made on a pulled-in article

Anchored by **`block` index + `start`/`end` character offsets** into the flat
block text, with `quote` kept alongside so a highlight can re-find itself if the
article is re-fetched.

`grasp` is a string with three meanings, and it's the whole point of the feature:

| `grasp`  | Meaning          |
| -------- | ---------------- |
| `"got"`  | could explain it |
| `"half"` | half there       |
| `"lost"` | it lost you      |

`half` and `lost` feed the daily room's "what I don't get yet" pile. Plus `note`
(≤2000), timestamps, `@@index([bookmarkId])`, cascade from `Bookmark`.

### `Visit` — analytics

`path`, `country`, `city`, `region`, `referrer` (host only), `device`, `ipHash`
(salted SHA-256 prefix, never a raw IP), `visitorName` (only if signed in),
`createdAt`, `@@index([createdAt])`. Owner visits are never inserted.

## Group 4 — Learning (`Roadmap`, `RoadmapStep`, `ProblemLog`, `Setting`, `DailyTick`)

### `Roadmap`

`slug @unique`, `title`, `subtitle`, `emoji @default("🗺️")`, `sort`,
`private: Boolean` (owner-only, e.g. personal STAR stories), `createdAt`, `steps`.

Note: the whole `/roadmaps` room is already owner-only, so `private` is a second
layer used for display (a 🔒 badge on the index).

**There is no API for creating roadmaps or steps.** They're inserted directly
into the database — see [08 — Operations](08-operations.md#seeding-data-that-has-no-ui).

### `RoadmapStep`

| Field                 | Notes                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order`               | sort key within the roadmap                                                                                                                                   |
| `group`               | section header, e.g. `"Ch 2"` or `"Scaling"`; `""` for ungrouped                                                                                              |
| `title`               | **also the join key to `app/lib/dsaContent.ts` and to `ProblemLog.pattern`.** Renaming a DSA step title silently detaches its templates, problems and history |
| `detail`, `link`      | `link` may be an internal deep link like `/study?book=<id>&loc=ch03.html%23sec` — the reader parses `loc` out of it to auto-tick steps as you read            |
| `recallQ` / `recallA` | active-recall prompt and answer                                                                                                                               |
| `done`                | the owner's progress. Reading a linked book only ever ticks, never unticks                                                                                    |
| `confidence`          | **a separate axis from `done`**: `0` unrated, `1` lost, `2` shaky, `3` solid. Feeds the strong/weak board                                                     |

### `ProblemLog`

One drilled LeetCode problem, keyed by `url @unique`.

| Field             | Notes                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `pattern` | `pattern` is the `RoadmapStep.title` it was drilled under — how the board groups them. `@@index([pattern])`                                               |
| `status`          | `"solved"` \| `"struggled"`. (`"clear"` is accepted by the API as a _delete_ instruction, never stored)                                                   |
| `auto`            | `true` when the LeetCode sync created it. **A hand-set verdict is never overwritten by the sync** — any handwritten `status` flips `auto` back to `false` |
| `rating`          | _your_ felt difficulty, `1` brutal → `5` easy, `0` unrated. Deliberately separate from LeetCode's easy/medium/hard                                        |
| `note`            | ≤4000 chars. LeetCode's own notes have no public API, so these are the house's                                                                            |

### `Setting`

`key @id` / `value` / `updatedAt`. "Config that wants a UI rather than a
redeploy." Two keys today, both in `app/lib/settings.ts`:
`leetcode.username`, `leetcode.syncedAt`.

### `DailyTick`

`kind` + `day` with `@@unique([kind, day])` — one tick per habit per day,
upserted so ticking twice is idempotent. `day` is a **visitor-local**
`"YYYY-MM-DD"` string, not a timestamp. `kind` is `"article" | "spanish"` in the
schema comment but `dailyTickSchema` also accepts `"listening"`.

## Cascade map

```
User ─┬─> Account, Session          (cascade)
      ├─> Book ─┬─> Annotation      (cascade)
      │         └─> ReadingProgress (cascade)
      ├─> Annotation                (cascade)
      └─> ReadingProgress           (cascade)

Roadmap  ──> RoadmapStep            (cascade)
Bookmark ──> Highlight              (cascade)

No relations at all: Post, Image, Idea, Frame, Visit, ProblemLog, Setting, DailyTick
```

Deleting the owner `User` row wipes the entire library, all annotations and all
reading progress — but leaves posts, frames, ideas, bookmarks, roadmaps and
problem logs untouched (they have no owner column).

## Enum-ish string fields (validated in Zod, not the database)

| Model.field              | Allowed values                          | Schema                   |
| ------------------------ | --------------------------------------- | ------------------------ |
| `Idea.bucket`            | read, write, explore, solve             | `ideaInputSchema`        |
| `Frame.kind`             | job, gig, project, achievement, sandbox | `frameInputSchema`       |
| `Highlight.grasp`        | got, half, lost                         | `graspSchema`            |
| `ProblemLog.status`      | solved, struggled (+ `clear` = delete)  | `problemLogSchema`       |
| `DailyTick.kind`         | article, spanish, listening             | `dailyTickSchema`        |
| `RoadmapStep.confidence` | 0–3                                     | `roadmapStepPatchSchema` |
| `ProblemLog.rating`      | 0–5                                     | `problemLogSchema`       |

Because they're plain strings/ints in Postgres, direct SQL inserts can write
values the UI can't render. Validate at the edge.
