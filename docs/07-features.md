# 07 — Feature deep dives

The five non-obvious subsystems, in rough order of complexity.

---

## 1. The EPUB reader (`/study`)

Files: `app/study/page.tsx` → `ReaderApp.tsx` → `Library.tsx` / `UploadDropzone.tsx` / `Reader.tsx`,
plus `app/lib/epub.ts`, `app/lib/api.ts`, `app/lib/types.ts`.

### Upload path

1. `ReaderApp.addBook(file)` rejects anything not `.epub`.
2. The file is read into an `ArrayBuffer` **once**, with up to 3 attempts and a
   700 ms backoff — iCloud file handles on iOS can go stale or still be
   downloading. Those same bytes are reused for parsing _and_ upload.
3. `parseBookMetadata(data)` (`app/lib/epub.ts`) dynamically imports `epubjs`,
   reads title/creator, and converts `book.coverUrl()` to a data URL. It hands
   epub.js a `data.slice(0)` copy because epub.js consumes the buffer. All
   best-effort — failure falls back to the filename.
4. `POST /api/books` as multipart. The EPUB lands in the `Book.data` column.

### Reading path

`Reader.tsx` is the biggest file in the repo (1079 lines). What it does:

- Fetches the book from `/api/books/<id>` and renders with epub.js.
- **Two flow modes**: `paginated` and `scrolled-doc`, remembered in
  `localStorage["readingMode"]`. In paginated mode a media query switches
  `spread` between `"none"` (portrait) and `"auto"` (landscape two-page).
- **Font scaling** in `localStorage["fontScale"]`, applied via
  `rendition.themes.fontSize(`${scale}%`)`.
- **Table of contents** flattened from the possibly-nested EPUB nav
  (`flattenToc`, keeps depth for indentation).
- **Selection → annotation.** A selection becomes a `PendingSelection`
  (`cfiRange` + `text`); adding a comment POSTs to
  `/api/books/<id>/annotations`. Highlights are drawn through
  `rendition.annotations.add("highlight", …)` with two styles — amber
  `#fbbf24 @ 0.35` for yours, blue `#60a5fa @ 0.30` for everyone else's.
- **Polling.** Annotations reload every `POLL_MS = 5000` so notes written
  elsewhere show up.
- **Progress.** On every `relocated` event, `saveProgress(bookId, cfi)` is
  debounced by **1200 ms**, and "page X of Y" is computed from
  `book.locations`.
- Keyboard navigation via a `keydown` listener; theme picker and music button
  are embedded in the reader chrome.

### Deep links and restore

- `?book=<id>` opens that book; the URL is kept in sync via
  `history.replaceState` and the last book is remembered in
  `localStorage["lastBook"]`.
- `?loc=<epub href>` is a **one-shot** jump to a section, honoured only when it
  arrives alongside an explicit `?book=`, and cleared from the URL afterwards so
  shared links stay just `?book=`.
- `/` forwards legacy `/?book=…` links to `/study?book=…`.

### Auto-ticking roadmap steps while reading

This is the subtlest logic in the codebase. Roadmap steps can link to a book
section (`/study?book=<id>&loc=ch03.html%23sec_storage`). Reading past that
section ticks the step.

1. `fetchRoadmapStepsForBook(bookId)` → `GET /api/roadmap-steps/for-book/<id>`,
   which returns `{ id, loc, done }[]` for the owner and `[]` for everyone else
   (so visitors silently don't track).
2. `resolveTrackedSteps()` groups steps by chapter href, loads each spine
   section **once**, finds the anchored element (`getElementById`, falling back
   to `doc.body`), asks epub.js for `section.cfiFromElement(el)`, unloads, then
   sorts all results by `EpubCFI.compare` — i.e. into reading order. Anything
   that won't resolve is skipped (commit `a732f39` fixed the reader blanking
   when a jump couldn't resolve).
3. `syncRoadmap(cfi, backfill?)` on each `relocated`:
   - A step's **threshold is the _next_ step's CFI** (or its own, for the last
     step) — so a section counts as read once you reach the following one.
   - Normally a step ticks only when you **cross** the threshold (were before
     it, now at/after it), so jumping straight to chapter 9 doesn't claim
     chapters 1–8.
   - `backfill = true` is used **once**, when resuming at a saved position, to
     tick everything up to there.
   - Ticks accumulate in a pending set, flushed after **1500 ms** via
     `markRoadmapStepsRead` → `PATCH /api/roadmap-steps/for-book/<id>`, which
     only ever sets `done: true` and scopes the update to steps linked to that
     book.

---

## 2. The reading desk (`/daily/read/[id]`)

Files: `app/daily/read/[id]/page.tsx`, `ArticleReader.tsx`, `app/lib/article.ts`,
`app/api/bookmarks/[id]/article/route.ts`, `app/api/highlights*`.

The point, per the code comments: _separate what actually landed from what only
looked like it did._

### Pulling an article in

`POST /api/bookmarks/<id>/article` with `{ mode: "fetch" }` or
`{ mode: "paste", text }`.

`fetchArticle()` guard rails:

| Guard        | Value                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Protocol     | `http:` / `https:` only                                                                                                                                      |
| SSRF         | `isPrivateHost()` rejects `localhost`, `*.local`, `*.internal`, `::1`, `fc…`/`fd…`, and IPv4 `0.*`, `10.*`, `127.*`, `169.254.*`, `172.16–31.*`, `192.168.*` |
| Timeout      | 12 s (`AbortSignal.timeout`)                                                                                                                                 |
| Size         | 4 MB                                                                                                                                                         |
| Content type | must look like html/xhtml/plain text                                                                                                                         |
| User-Agent   | a full Chrome UA string — plain crawlers get stubs or 403s                                                                                                   |

Then `@mozilla/readability` + `linkedom` reduce the page to a **flat array of
blocks**:

```ts
type Block =
  | { t: "p" | "h2" | "h3" | "li" | "quote" | "code"; s: string }
  | { t: "img"; src: string; alt: string };
```

Why flat plain text, explicitly: _"highlights anchor to (block, start, end)
offsets, which only stay honest if the text is a flat string, and rendering
someone else's markup would mean trusting it."_ Bold and inline links are the
price paid.

Details: `h1`–`h6` collapse to `h2`/`h3`; `pre` keeps line breaks, everything
else collapses whitespace; a `li` wrapping a nested list yields to its children
so text isn't doubled; images resolve relative URLs against the **post-redirect**
`res.url`, take `src` → `data-src` → first `srcset` candidate, and reject
non-http(s) (no `data:` payloads); consecutive duplicate blocks are dropped;
caps are 1500 blocks and 20 000 chars per block. If Readability yields nothing
usable the whole `document.body` is used instead; if there's still no text block,
`ArticleError` → the UI tells you to paste it in.

`articleFromText()` (paste path) splits on blank lines into paragraphs — nothing
else assumed.

The cached body (`blocks`, `byline`, `wordCount`) is **never** returned by any
public endpoint, and `/daily/read/[id]` is owner-only + `noindex`, because it's a
private cache of someone else's writing.

### Highlights and re-anchoring

A selection inside a `data-block` element becomes `{ block, start, end, quote }`
and is saved with one of three `grasp` values: **got** (could explain it) /
**half** (half there) / **lost** (it lost you).

Because an article can be pulled in again and come back slightly different, every
highlight is re-anchored before drawing (`anchor()` in `ArticleReader.tsx`), in
three escalating steps:

1. Exact: `blockText.slice(start, end) === quote` → use the stored offsets.
2. Same paragraph, shifted: `indexOf(quote)` within the same block.
3. Moved paragraph: first block anywhere that still contains the quote.

Anything unfindable becomes an **orphan** — listed below the article instead of
drawn on it, rather than silently dropped.

`half` and `lost` marks aggregate into the daily room's "what I don't get yet"
pile (latest 30, owner-only), and per-article grasp counts come from a
`groupBy(["bookmarkId","grasp"])`.

---

## 3. Roadmaps, the DSA board & LeetCode sync (`/roadmaps/[slug]`)

Files: `app/roadmaps/[slug]/page.tsx`, `RoadmapView.tsx`, `DsaStrengthBoard.tsx`,
`LeetCodeSync.tsx`, `PatternViz.tsx`, `app/lib/dsaContent.ts`,
`app/lib/dsaStrength.ts`, `app/lib/leetcode.ts`, `app/lib/settings.ts`.

### Steps

`RoadmapStep` rows ordered by `order`, visually grouped by `group`. Each step
has a `detail`, an optional `link` (external, or a `/study?book=…&loc=…` deep
link), and an active-recall pair `recallQ`/`recallA`. Two independent axes:

- **`done`** — been through it. Can be ticked by hand or by reading the linked
  book section.
- **`confidence`** — 0 unrated / 1 lost / 2 shaky / 3 solid. _"Having been
  through a pattern isn't the same as being able to write it cold."_

Both go through `PATCH /api/roadmap-steps/<id>`.

### DSA content join

`app/lib/dsaContent.ts` is a `Record<string, PatternContent>` keyed by the
**exact `RoadmapStep.title`**, holding a code `template`, an optional `viz` key
(matched to a case in `PatternViz`), and a list of LeetCode `problems`.

⚠️ **Renaming a DSA step title detaches its template, its problem list, and every
`ProblemLog` row recorded under it** (`ProblemLog.pattern` stores the title too).
Rename in the DB and in `dsaContent.ts` together, and update existing
`ProblemLog.pattern` values.

### Strength scoring (`app/lib/dsaStrength.ts`)

Two signals, because either alone lies — a self-rating flatters you the week
after reading, a solved tally says nothing about patterns you've avoided, and
untested is its own answer.

```
drillScore(d) = 0.15                        if not solved
              = 0.75                        if solved, unrated
              = 0.5 + ((rating-1)/4) * 0.5  if solved and rated (1 brutal → 5 easy)

rated   = (confidence - 1) / 2   when confidence > 0, else null
drilled = mean(drillScore)       when there are drills, else null

strength = 0.6 * rated + 0.4 * drilled   when both exist
         = whichever exists               otherwise
         = null                           when neither
```

`RATING_WEIGHT = 0.6` — "I could write this cold" is what an interview asks for.

Bands: `strong ≥ 0.7`, `shaky ≥ 0.4`, `weak < 0.4`, `untested` for `null`.
`BAND_TINT` reuses the reading-desk highlight colours (`hl-got`/`hl-half`/`hl-lost`).
`rankPatterns()` sorts **weakest first**, untested last — "the board is a to-do
list, not a trophy shelf."

### Problem log

`POST /api/problem-log`, keyed by URL. `status` / `rating` / `note` can each be
sent alone, so ticking a problem off and writing it up are separate moments.
`status: "clear"` deletes the row. Any handwritten `status` sets `auto: false`.

### LeetCode sync

`app/lib/leetcode.ts` talks to `https://leetcode.com/graphql` **unauthenticated**
— public profiles answer without a key, which is the only reason this works. A
`Referer: https://leetcode.com` header is required or LeetCode turns the request
away. 10 s timeout.

- `checkProfile(username)` → `matchedUser`. LeetCode answers unknown handles with
  a GraphQL _error_, so not-found arrives as a throw; it's translated into a
  message that also mentions private profiles, since those look identical from
  outside. Returns LeetCode's own spelling, which is what gets stored.
- `recentSolves(username)` → `recentAcSubmissionList(limit: 20)`. **That ~20-item
  ceiling is LeetCode's, not ours** — the sync moves forward from now and cannot
  backfill your history.
- `problemsBySlug()` builds slug → `{url,name,pattern}` from `DSA_CONTENT`.

`POST /api/leetcode/sync` inserts only problems not already logged
(`skipDuplicates: true`), stamps `Setting["leetcode.syncedAt"]`, and returns
`added` (so the board ticks without a reload) plus `offBoard` (recent solves that
aren't on the board at all).

NeetCode has no equivalent public API — its progress lives behind your account —
which is why LeetCode is the account being read.

---

## 4. The daily room (`/daily`)

Files: `app/daily/page.tsx`, `DailyRoom.tsx`, `app/lib/feeds.ts`, `app/lib/spanish.ts`.

Three habits and a shelf.

### Article of the day

`app/lib/feeds.ts` reads 8 engineering feeds (Netflix, Pinterest, Stripe,
Cloudflare, Meta, Google Developers, Martin Fowler, InfoQ — Uber's was retired
upstream) with a hand-rolled regex reader that handles both RSS 2.0
(`<item><link>text</link>`) and Atom (`<entry><link href>`). Each fetch has a
6 s timeout and `next: { revalidate: 3600 }` — "one trip to the newsstand per
hour". `Promise.allSettled`, so a dead feed just contributes nothing.

`articleOfTheDay(day)` is **deterministic per day**: a small `dayHash` picks a
source bucket first, then a post within it, so the pick doesn't shuffle on
refresh and isn't dominated by whichever feed publishes most.

### Spanish

`app/lib/spanish.ts` is static content: `SPANISH_SCENES` (a scene, a few lines,
and a `yourTurn` line to say out loud) and `LISTENING_LINES`. `sceneOfTheDay(day)`
and `listeningOfTheDay(day)` are day-hashed the same way. `DailyRoom` speaks
lines with the Web Speech API (`pickSpanishVoice`, `speakSpanish` with an
adjustable rate).

### Streaks

`DailyTick` rows, one per `(kind, day)`, upserted so ticking twice is harmless.
`day` is computed **client-side** (`localDay(offset)`) so the streak follows the
visitor's local date; the server also computes its own `serverDay` and passes it
in for comparison. `kind` is `article` | `spanish` | `listening`.

### The article shelf

`Bookmark` rows. Favourites form the "special pile"; the rest are grouped by
`shelf` — named shelves alphabetically, then the `""` catch-all last. Per read
you can: star it, move it to a shelf (freeform name), pull the article in, read
it at the desk, or forget it. Grasp counts appear on each card and the
"what I don't get yet" list sits below — both owner-only.

---

## 5. The writing room (`/notes`)

Files: `app/notes/*`, `PostEditor.tsx`, `TagInput.tsx`, `CoverPicker.tsx`,
`app/lib/reading.ts`, `app/lib/tags.ts`.

- Posts are **markdown**, stored raw, rendered at read time with
  `marked.parse(content, { async: false, breaks: true })` into the `.article`
  stylesheet. Rendering is `dangerouslySetInnerHTML` — safe only because the
  owner is the only author.
- **Drafts** are `publishedAt: null`. They sort first (`nulls: "first"`), show a
  "draft" badge, and their cards link to the editor rather than the reader.
  They're still publicly reachable via `/api/posts` and `/notes/[id]`.
- **Cover image**: `coverImage` if set (chosen and cropped in `CoverPicker`,
  uploaded to `/api/images`), else the first markdown image in the body
  (`firstImage()`), else a serif initial on a tinted card.
- **Tags** are freeform, normalised by `tagsSchema` (trim, collapse whitespace,
  case-insensitive dedupe, ≤40 chars each, ≤12 per post). `postTagCounts()`
  powers both the editor's suggestions and the room's topic filter, so a tag
  typed once can be clicked instead of retyped.
- **Evergreen sinking**: posts tagged `learning` (`EVERGREEN_TAGS` in
  `app/notes/page.tsx`) sort below dated essays via a stable sort, with a
  "learning notes" divider inserted at the boundary — and the divider is mapped
  onto the current page so it lands where the boundary actually falls.
- **Pagination**: 12 per page (fills 2- and 3-column grids without an orphan
  row); page links preserve the active tag and drop `?page` for page 1.
- **Read time**: `readingStats()` strips markdown syntax so links and image
  markup don't inflate the count, then 200 wpm. (The reading desk uses a
  separate 220 wpm figure in `article.ts` — they're independent.)

---

## Smaller things

- **`/workshop`** — the ESP32 mission-control tiles (device, LED, temperature,
  console) are deliberate placeholders in a "no device yet" state, laid out so
  wiring the real board in later is a swap of placeholders for data. Below them,
  `WorkshopShelf` shows `Frame` rows with `kind: "sandbox"`.
- **`/visitors`** — totals, unique visitors by distinct `ipHash`, top 8
  countries/pages/referrers via `groupBy`, and the last 120 visits with
  flag emoji (`flag()` maps an ISO-2 code to regional indicators) and relative
  times. Owner-only, `noindex`, opened by the Konami code in `SecretDoor`.
- **PWA** — `app/manifest.ts` plus `appleWebApp` metadata make it installable
  standalone; `viewportFit: "cover"` and `interactiveWidget: "resizes-content"`
  are there for phone use.
