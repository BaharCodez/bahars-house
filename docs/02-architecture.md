# 02 — Architecture

## Stack

- **Next.js 16.2.9**, App Router only (no `pages/`). React 19.2.4.
- **TypeScript 5**, `strict: true`, `noEmit`, target ES2017, path alias `@/*` → repo root.
- **Tailwind CSS 4** via `@tailwindcss/postcss` — no `tailwind.config.js`; theme
  tokens are declared in CSS with `@theme inline` (see [06](06-ui-and-styling.md)).
- **Prisma 7.8** with the **`prisma-client` generator** (not the legacy
  `prisma-client-js`) and the **`@prisma/adapter-pg` driver adapter** over `pg`.
- **Auth.js / NextAuth 5 beta** with the Prisma adapter, JWT session strategy.
- **Zod 4** for every request body.
- Content processing: `@mozilla/readability` + `linkedom` (server-side article
  extraction), `marked` (markdown → HTML for posts), `epubjs` (client-side EPUB).
- `@tiptap/*` is installed but **not imported anywhere** — the post editor is a
  plain markdown `<textarea>`. See [09 — Gotchas](09-gotchas.md).

> `AGENTS.md` warns that this Next version differs from older training data, and
> to read `node_modules/next/dist/docs/` before writing code. That's real advice:
> `params`/`searchParams` are Promises here, `connection()` replaces the old
> `unstable_noStore`, and `allowedDevOrigins` is a Next 16 config key.

## Directory layout and what owns what

```
app/
  layout.tsx        Root layout (async server component). Loads 7 Google fonts,
                    injects the pre-paint theme script, calls isOwner() to decide
                    whether owner-only nav items render, mounts Providers →
                    Sidebar → <main>{children}</main> → VisitTracker → SecretDoor.
  page.tsx          "/" the hallway. Redirects legacy /?book=<id> links to /study.
  globals.css       Tailwind entry, 7 themes, all keyframes, .article and
                    .reader-body typography, DSA animation classes.
  manifest.ts       PWA manifest (name "Bahar's House", standalone, icons).
  favicon.ico

  <room>/page.tsx   One server component per room. Fetches with Prisma directly,
                    computes `canEdit = await isOwner()`, passes plain data down
                    to one big client component.

  api/**/route.ts   Route handlers. The only write surface. Each one validates
                    with Zod and gates with requireOwner().

  components/       28 components. Two are server components (RoomShell,
                    RoomBanner); the other 26 are "use client".

  lib/              Mixed server-only and shared modules (below).

  generated/prisma/ Prisma client output. Gitignored. Never edit, never import
                    from outside lib/prisma.ts except for the `Prisma` namespace
                    (used in app/api/bookmarks/route.ts for error codes).
```

### `app/lib` — server-only vs shared

`"server-only"` at the top (importing these from a client component is a build
error):

| Module        | Responsibility                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma.ts`   | The single `PrismaClient`, built on `PrismaPg({ connectionString: DATABASE_URL })`, cached on `globalThis` outside production so hot reload doesn't exhaust connections |
| `session.ts`  | `currentUserId()`, `actorUserId()`, `isOwner()`, `requireOwner()` — the whole permission model                                                                          |
| `settings.ts` | `getSetting` / `setSetting` / `clearSetting` over the `Setting` key-value table; exports the `leetcode.username` and `leetcode.syncedAt` keys                           |
| `article.ts`  | Fetch a URL → Readability → flat `Block[]`; SSRF guard; paste path                                                                                                      |
| `feeds.ts`    | RSS/Atom newsstand, `articleOfTheDay(day)`                                                                                                                              |
| `leetcode.ts` | LeetCode public GraphQL: `checkProfile`, `recentSolves`, `problemsBySlug`                                                                                               |

No `"server-only"` marker but effectively server-side (they import `prisma`):
`tags.ts` (`postTagCounts()`).

Shared / pure (safe on both sides):

| Module           | Responsibility                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validation.ts`  | Every Zod schema in the app — the canonical spec of what each endpoint accepts                                                                     |
| `types.ts`       | `CurrentUser`, `BookMeta`, `Annotation`, `AnnotationInput` for the reading API                                                                     |
| `api.ts`         | Typed browser-side client for the _reading_ endpoints only (books, annotations, progress, roadmap-step sync). Everything else calls `fetch` inline |
| `dsaStrength.ts` | Pure scoring: `strengthOf`, `bandOf`, `tally`, `rankPatterns`                                                                                      |
| `dsaContent.ts`  | Static per-pattern templates + LeetCode problem lists, keyed by exact roadmap step title                                                           |
| `spanish.ts`     | Static Spanish scenes + `sceneOfTheDay`, `listeningOfTheDay`                                                                                       |
| `reading.ts`     | `readingStats(markdown)` → words + minutes at 200 wpm                                                                                              |
| `themes.ts`      | The 7 theme ids/labels/swatches (must match `[data-theme=…]` in CSS)                                                                               |
| `epub.ts`        | Client-side EPUB metadata + cover extraction before upload                                                                                         |
| `useFileDrop.ts` | Drag-and-drop hook                                                                                                                                 |

## Rendering strategy

Every page is a **server component**. The pattern is uniform:

```tsx
export default async function SomeRoom() {
  await connection();                       // opt out of static prerender
  const [data, canEdit] = await Promise.all([prisma.thing.findMany(…), isOwner()]);
  return <RoomShell …><ThingClient data={data} canEdit={canEdit} /></RoomShell>;
}
```

Three things to internalise:

1. **`await connection()` from `next/server`** appears in `daily`,
   `daily/read/[id]`, `hallway`, `notes`, `notes/board`, `roadmaps`,
   `roadmaps/[slug]`, `visitors`, `workshop`. It forces per-request rendering.
   The reason is in the comments: _"CI builds have no database"_ — `npm run build`
   runs in GitHub Actions with no `DATABASE_URL`, so any page that would be
   statically prerendered while reading Postgres breaks the build. **Add
   `await connection()` to every new DB-reading page.**
   (`notes/[id]` and `notes/write` don't call it — they're dynamic anyway
   because they read `params`/`searchParams`.)

2. **`params` and `searchParams` are Promises.** Always
   `const { id } = await params;`. Same in route handlers:
   `{ params }: { params: Promise<{ id: string }> }`.

3. **`canEdit` is computed on the server and passed down as a prop.** Client
   components use it to decide whether to _render_ controls. It is never the
   security boundary — the API re-checks. See [03](03-auth-and-access-control.md).

## Data flow

```
Browser (client component)
   │  fetch("/api/…")  ── plain fetch inline, or app/lib/api.ts for reading
   ▼
Route handler (app/api/**/route.ts)
   │  1. requireOwner()      → 401 for everyone but the signed-in owner
   │  2. Zod .safeParse(body) → 400 with parsed.error.issues[0].message
   │  3. prisma.<model>.…
   ▼
Postgres (Neon in prod) via PrismaPg driver adapter
```

Reads split two ways:

- **Initial paint** — the server component queries Prisma directly and passes
  data as props. No client fetch on load.
- **After a mutation** — client components mostly do optimistic local state
  updates plus the API call; a few (`ReaderApp`) refetch through `app/lib/api.ts`.

The reader is the one polling client: `Reader.tsx` re-fetches annotations every
`POLL_MS = 5000` so notes added elsewhere appear.

## Request lifecycle for a typical owner write

Taking "star an article on the daily-room shelf":

1. `DailyRoom.tsx` (client) `PATCH /api/bookmarks/<id>` with `{ favorite: true }`.
2. `app/api/bookmarks/[id]/route.ts` → `requireOwner()`:
   - `auth()` reads the JWT cookie → `session.user`
   - the email is compared against `OWNER_EMAIL` (falling back to a DB lookup by
     user id when the JWT lacks an email, then to "oldest account" when
     `OWNER_EMAIL` is unset)
   - non-owner → `401 {"error": "Only the keeper of this house can change things — sign in."}`
3. `bookmarkPatchSchema.safeParse` — requires at least one of `favorite`/`shelf`.
4. `prisma.bookmark.update` with an explicit `select` that **excludes the cached
   article `blocks`** (that copy of someone else's article never leaves the
   owner's session).
5. JSON back; the component had already updated its local state.

## Build & type boundaries worth respecting

- `types/next-auth.d.ts` widens `Session["user"]` with `id: string`; the `jwt`
  and `session` callbacks in `app/lib/auth.ts` are what actually populate it.
- `tsconfig.json` includes `.next/types/**` and `.next/dev/types/**`, so route
  types are checked against the generated Next types — a mismatched
  `params` signature fails `tsc`, not just runtime.
- ESLint flat config (`eslint.config.mjs`) = `next/core-web-vitals` +
  `next/typescript` + `eslint-config-prettier` last, with `.ua/**` added to the
  ignore list. Prettier owns formatting (2-space, double quotes, trailing
  commas, 80 cols, Tailwind class sorting via `prettier-plugin-tailwindcss`).
