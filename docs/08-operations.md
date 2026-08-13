# 08 — Operations

## Continuous integration

`.github/workflows/ci.yml` — on push and PR against `main`:

```
actions/checkout@v4 → actions/setup-node@v4 (node 22, npm cache)
→ npm ci → npm run lint → npm run format:check → npm run build
```

There is **no `DATABASE_URL` in CI**, and no test step (there are no tests). The
build succeeds without a database only because every DB-reading page calls
`await connection()` to opt out of static prerendering. If you add a page that
queries Prisma without it, **CI breaks** — that's the failure mode to recognise.

`npm run build` = `prisma generate && next build`, so the generated client is
always fresh in CI.

> ⚠️ **`format:check` currently fails.** As of `907c45c`, nine committed files
> aren't Prettier-formatted: `app/api/track/route.ts`, `app/components/CoverPicker.tsx`,
> `app/components/PatternViz.tsx`, `app/components/Reader.tsx`,
> `app/components/Sidebar.tsx`, `app/lib/dsaContent.ts`, `app/notes/page.tsx`,
> `app/page.tsx`, `CLAUDE.md`. `npm run lint` and `npx tsc --noEmit` are both
> clean; only the formatting gate is red. Fix with `npm run format` — it's a
> whitespace-only diff, but it touches those nine files, so land it as its own
> commit.

## Deployment

- **Host:** Vercel. **Database:** Neon serverless Postgres.
- There is **no `vercel.json`** — Vercel's zero-config Next.js detection handles
  it. `npm run build` is the build command by virtue of `package.json`.
- Vercel sets `VERCEL_GIT_COMMIT_SHA`; `next.config.ts` slices it to 7 chars and
  exposes it as `NEXT_PUBLIC_BUILD`, which `SignedInBar` displays. That's how you
  confirm a phone actually loaded the latest deploy rather than a cached shell.

### Environment variables to set in Vercel

| Variable                                | Why it matters in production                                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | Neon pooled connection string                                                                                                                                                                                                                      |
| `AUTH_SECRET`                           | Must be stable, or sessions drop and visitor `ipHash` continuity breaks                                                                                                                                                                            |
| `OWNER_EMAIL`                           | **Required in practice.** Without it the owner check falls back to "oldest account in the database", which is fragile once several accounts exist (there are currently 6). If owner editing suddenly stops working in production, check this first |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Only if Google sign-in should work. The Google button renders regardless                                                                                                                                                                           |

Google OAuth also needs the deployed origin's callback
(`https://<domain>/api/auth/callback/google`) registered in Google Cloud Console.

### Branching

Git history shows both styles: earlier work went through PRs
(`fix/restore-google-signin`, `feat/daily-room-and-shelves`, …), while recent
practice is committing straight to `main`, which auto-deploys. The current
checkout is on `reading-desk-and-dsa-board`, one branch ahead of `main`. Pick one
convention and be aware that anything on `main` is live.

## Schema changes

**There are no migrations.** `prisma/migrations/` doesn't exist even though
`prisma.config.ts` points at it. The workflow so far:

```bash
# 1. edit prisma/schema.prisma
npx prisma generate     # refresh the client (also runs on npm install / build)
npx prisma db push      # apply to the database
```

`db push` diffs the schema against the live database. It will offer to drop
columns/tables when they no longer appear in the schema — **read the plan before
confirming**, especially against Neon.

Order of operations for a live change: push the schema **first** (additive
changes are backwards compatible), then deploy the code that uses it.

### Adopting migrations

If you want a real migration history:

```bash
npx prisma migrate dev --name init      # against a scratch database
# review prisma/migrations/*/migration.sql, commit it
npx prisma migrate deploy               # in each environment
```

Because the production database was created by `db push`, you'll need to
baseline it (`prisma migrate resolve --applied <migration>`) so the first
migration isn't re-run. Do that on a branch with a Neon branch database, not on
production.

## Seeding data that has no UI

Some content can only be created outside the app, because no endpoint exists:

| Data                     | How it's created                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `Roadmap`, `RoadmapStep` | **Database only.** There is no POST route — only `PATCH /api/roadmap-steps/[id]` (done/confidence) |
| Extra `Setting` keys     | `setSetting()` from server code, or SQL                                                            |
| The first `User`         | `/signup`, once, on an empty database                                                              |

Everything else (posts, images, ideas, frames, bookmarks, highlights, daily
ticks, problem logs, books) has an owner-only API and a UI.

### Option A — Prisma Studio (easiest for a few rows)

```bash
npx prisma studio
```

Reads `DATABASE_URL` via `prisma.config.ts` (which imports `dotenv/config`).
Point it at a scratch database first if you're experimenting.

### Option B — a scripted seed with raw `pg` (recommended for bulk)

`pg` and `dotenv` are already dependencies, and this avoids the Prisma-client
import problem described below. Write a `.mjs` file, run it with plain `node`,
and delete it afterwards (or keep it in a gitignored path):

```js
// seed-roadmap.mjs
import "dotenv/config";
import { Client } from "pg";

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const {
  rows: [rm],
} = await c.query(
  `insert into "Roadmap" (id, slug, title, subtitle, emoji, sort, private, "createdAt")
   values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, now())
   on conflict (slug) do update set title = excluded.title
   returning id`,
  ["my-path", "My Path", "one chunk at a time", "🗺️", 4, false],
);

const steps = [
  {
    order: 0,
    group: "Ch 1",
    title: "Reliability",
    detail: "…",
    recallQ: "…",
    recallA: "…",
  },
  // …
];
for (const s of steps) {
  await c.query(
    `insert into "RoadmapStep" (id, "roadmapId", "order", "group", title, detail, link, "recallQ", "recallA", done, confidence)
     values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, false, 0)`,
    [
      rm.id,
      s.order,
      s.group ?? "",
      s.title,
      s.detail ?? "",
      s.link ?? null,
      s.recallQ ?? "",
      s.recallA ?? "",
    ],
  );
}
await c.end();
```

Notes:

- Ids are `cuid()` **in Prisma only** — the column is a plain `text` primary key,
  so any unique string works. `gen_random_uuid()::text` is fine (pgcrypto is
  built into Postgres 13+ / Neon).
- Column names are case-sensitive and quoted (`"roadmapId"`, `"order"` — `order`
  is also a reserved word, so it must be quoted).
- For a DSA roadmap, **`RoadmapStep.title` must exactly match a key in
  `app/lib/dsaContent.ts`** or that step gets no template, no problems and no
  strong/weak row.

### Why not a Prisma script?

Both obvious approaches currently fail:

- `node script.ts` — Node can strip the types, but the generated client uses
  extensionless relative imports (`./enums`), which bare Node ESM won't resolve.
- `npx tsx script.ts` — esbuild throws a `TransformError` on the generated
  client.

If you want a Prisma-based script, run it _inside_ the Next runtime instead — a
temporary owner-only route handler that imports `@/app/lib/prisma`, hit once,
then delete. Otherwise use raw `pg` as above.

## Current production data (as of 2026-08-13)

Useful as a sanity baseline when pointing at the live database:

| Table                     | Rows                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `User`                    | 6 (3 with a password, 3 OAuth-only) — so `/signup` is closed                                          |
| `Roadmap` / `RoadmapStep` | 4 / 119                                                                                               |
| `Post`                    | 5                                                                                                     |
| `Book`                    | 3                                                                                                     |
| `Frame`                   | 12 (4 job, 4 gig, 3 achievement, 1 project — **no sandbox rows yet**, so the workshop shelf is empty) |
| `Bookmark` / `Highlight`  | 5 / 4                                                                                                 |
| `ProblemLog`              | 3                                                                                                     |
| `Visit`                   | 87                                                                                                    |
| `Setting`                 | 2 (`leetcode.username`, `leetcode.syncedAt`)                                                          |

Roadmaps: `ddia` (54 steps), `system-design` (31), `dsa` (24), `behavioral`
(10, `private: true`).

## Backups

Nothing is automated in this repo. Two things to know:

1. **EPUB files and post images live in the database as `Bytes`.** A logical dump
   is your only copy of them — there is no object storage.
2. Neon provides point-in-time restore and branch snapshots; use those, and take
   a `pg_dump` before any `db push` that drops columns.

```bash
pg_dump "$DATABASE_URL" -Fc -f house-$(date +%F).dump
```

## Local artefacts you can safely delete

| Path                             | What it is                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `dev.db` (4.4 MB)                | Leftover SQLite database from before the Postgres migration (`1f58739`). Gitignored, unused — nothing in the code opens SQLite any more |
| `.next/`, `tsconfig.tsbuildinfo` | Build caches                                                                                                                            |
| `.ua/`                           | The Understand-Anything knowledge graph (below)                                                                                         |
| `Library/`                       | macOS junk created at the repo root; explicitly gitignored                                                                              |
| `.DS_Store`                      | ditto                                                                                                                                   |

## The knowledge graph in `.ua/`

You generated one on **2026-07-23** at commit `67c30ed`, covering 68 files
(`.ua/meta.json`, `.ua/knowledge-graph.json` ≈ 145 KB, plus fingerprints and a
`.trash-*` folder of intermediate batches, layers, and a tour).

It is **stale** — roughly 20 commits have landed since, including the reading
desk, the DSA board, post cover images and roadmap read-tracking, none of which
it knows about. It's gitignored and regenerable.

To refresh or explore it, use the Understand-Anything skills:
`/understand` (regenerate), `/understand-dashboard` (visualise),
`/understand-chat` (ask questions), `/understand-explain` (deep-dive a file).
This `docs/` directory is hand-written and independent of it — the graph is a
navigation aid, these files are the reference.
