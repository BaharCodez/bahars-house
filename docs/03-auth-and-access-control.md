# 03 — Auth & access control

> `CLAUDE.md`: **"Make sure the public can not ever edit anything live on the
> website."** This document is how that's enforced. Read it before touching any
> route handler.

## Auth.js configuration — `app/lib/auth.ts`

```ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },  // 30 days
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [Google({ authorization: { params: { prompt: "select_account" } } }),
              Credentials({ … })],
  callbacks: { jwt, session },   // put user.id on the session
});
```

- **JWT sessions, not database sessions.** Credentials sign-in can't persist a
  DB session, so the whole app uses JWT. The `Session` table exists (Auth.js
  adapter shape) but is effectively unused.
- **`trustHost: true`** so sign-in works over a LAN IP in dev.
- **Credentials provider** validates with `credentialsSchema`, looks the user up
  by email, and `bcrypt.compare`s against `passwordHash`. Users with no
  `passwordHash` (OAuth-only) can't sign in this way — `authorize` returns
  `null`.
- **Google provider** reads `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` from the
  environment by convention. `prompt: "select_account"` makes repeat logins one
  click.
- The `jwt` callback copies `user.id` into `token.sub`; the `session` callback
  copies it back to `session.user.id`. `types/next-auth.d.ts` declares that field.

`app/api/auth/[...nextauth]/route.ts` is just `export const { GET, POST } = handlers;`.

## The three session helpers — `app/lib/session.ts`

All are `server-only`.

### `currentUserId(): Promise<string | null>`

The signed-in user's id, or `null`. Thin wrapper over `auth()`.

### `actorUserId(): Promise<string | null>`

**Who a write is attributed to.** If someone is signed in, them. Otherwise the
site owner — resolved by `OWNER_EMAIL` (oldest match wins), then by "oldest
account in the database". This exists so rows have a plausible author, _not_ as
a permission grant: every route that calls `actorUserId()` has already passed
`requireOwner()`. Don't ever use `actorUserId()` as an authorization check.

### `isOwner(): Promise<boolean>`

The real identity check:

1. No session → `false`.
2. Take `session.user.email`. **If the JWT arrived without an email, look it up
   by `session.user.id`** — this fallback is why the owner check "never misses"
   (it was an actual bug fix, commit `4e84462`).
3. If `OWNER_EMAIL` is set: `true` iff the email is in that comma-separated,
   lowercased list.
4. If `OWNER_EMAIL` is **unset**: `true` iff the email matches the oldest `User`
   row. Convenient locally, fragile in production — **always set `OWNER_EMAIL`
   in the deploy environment.**

### `requireOwner(): Promise<NextResponse | null>`

The route guard. Returns `null` to proceed, or the 401 response to return:

```ts
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  …
}
```

401 body: `{ "error": "Only the keeper of this house can change things — sign in." }`

## Who can do what

### Public (no session)

**Reads.** All of these are open by design:

| Endpoint / page                                                                                                | Notes                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/books`, `GET /api/books/[id]`                                                                        | The shelf is public; `[id]` streams the raw EPUB bytes with `Cache-Control: private, max-age=3600` |
| `GET /api/books/[id]/annotations`                                                                              | Everyone sees everyone's margin notes                                                              |
| `GET /api/books/[id]/progress`                                                                                 | Returns `{cfi:null}` when there's no actor                                                         |
| `GET /api/bookmarks`                                                                                           | Card fields only — **never `blocks`/`byline`/`wordCount`**                                         |
| `GET /api/frames`, `GET /api/ideas`, `GET /api/daily`                                                          | Portfolio wall, sticky notes, streak board                                                         |
| `GET /api/posts`, `GET /api/posts/[id]`                                                                        | **Includes drafts** (`publishedAt: null`)                                                          |
| `GET /api/images/[id]`                                                                                         | `Cache-Control: public, max-age=31536000, immutable`                                               |
| `/`, `/hallway`, `/notes`, `/notes/[id]`, `/notes/write`, `/study`, `/daily`, `/workshop`, `/login`, `/signup` |                                                                                                    |

**Writes.** Exactly two, both intentional:

- `POST /api/signup` — only on a database with zero `User` rows.
- `POST /api/track` — appends a `Visit` row. Skipped entirely for the owner.

Everything else returns 401.

### Owner (signed in and matching `OWNER_EMAIL`)

Every mutation, plus these owner-only surfaces:

| Surface                                    | Enforcement                                                                                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/roadmaps` and `/roadmaps/[slug]`         | `if (!(await isOwner())) notFound()` — a 404, not a 401, so the room's existence isn't advertised. Also hidden from the sidebar/hallway nav and `robots: { index: false }` |
| `/visitors`                                | Same 404 pattern; reachable via the Konami code (`SecretDoor.tsx`) but the code is obscurity, not security                                                                 |
| `/daily/read/[id]` (reading desk)          | `if (!canEdit) notFound()` — it renders a cached copy of someone else's article, so it stays behind the owner's door. `robots: noindex`                                    |
| `GET /api/roadmap-steps/for-book/[bookId]` | Returns `[]` for non-owners rather than 401, so the reader silently skips progress tracking for visitors                                                                   |
| Grasp/highlight data in `/daily`           | The page only builds `marks` and `fuzzy` when `canEdit`                                                                                                                    |

### Nobody

- `POST /api/signup` once any user exists — "This house isn't handing out new keys."

## Two layers, and why both exist

1. **UI layer** — server components pass `canEdit`/`isOwner` down; client
   components hide buttons. Cosmetic only.
2. **API layer** — `requireOwner()` at the top of every mutating handler. This
   is the actual boundary.

A hostile visitor can call any endpoint directly. That's fine as long as the
guard is present. **The checklist when you add a route handler:**

- [ ] Mutating? First two lines are `const denied = await requireOwner(); if (denied) return denied;`
- [ ] Body parsed with a Zod schema from `app/lib/validation.ts`, returning 400 with `parsed.error.issues[0]?.message`
- [ ] `select:` restricted so private fields (article `blocks`, EPUB `data`, `passwordHash`) can't leak
- [ ] If it exposes owner-private _reads_, gate with `isOwner()` and prefer `notFound()` for whole pages

## Ownership checks _within_ owner-scoped data

A few routes additionally check row ownership via `actorUserId()`, left over
from the multi-user era:

- `DELETE /api/annotations/[id]` → 403 unless `annotation.userId === actor`
- `DELETE /api/books/[id]` → 403 unless `book.ownerId === actor`

Harmless today (one owner), and correct if the app ever goes multi-user again.

## Privacy details worth knowing

- `POST /api/track` stores **no raw IP**. It hashes `ip + AUTH_SECRET` with
  SHA-256 and keeps the first 16 hex chars as `ipHash` (used only for a
  distinct-count of "unique visitors"). Rotating `AUTH_SECRET` breaks continuity
  of that count.
- Location comes from Vercel geo headers (`x-vercel-ip-country`, `-city`,
  `-country-region`) — coarse, and empty in local dev.
- `visitorName` is only set if the visitor happened to be signed in.
- Device/browser is a hand-rolled user-agent sniff, no external dependency.
- `POST /api/track` returns 204 immediately for the owner: the owner's own
  visits are never logged.
