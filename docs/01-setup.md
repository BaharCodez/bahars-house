# 01 — Setup & installation

## Prerequisites

| Tool       | Version used here            | Notes                                                                      |
| ---------- | ---------------------------- | -------------------------------------------------------------------------- |
| Node.js    | 26.4.0 locally, **22** in CI | Next 16 needs ≥ 20.9. CI pins 22, so don't rely on newer-than-22 built-ins |
| npm        | 11.17.0                      | `package-lock.json` is committed; use `npm ci` for reproducible installs   |
| PostgreSQL | any 14+                      | Production uses [Neon](https://neon.tech) serverless Postgres              |

There is no Docker setup, no test runner, and no `scripts/` directory. The
whole toolchain is npm scripts + Prisma CLI.

## 1. Install

```bash
npm install       # or: npm ci
```

`postinstall` runs `prisma generate`, which writes the Prisma client to
`app/generated/prisma/`. That directory is gitignored and **must exist** before
anything type-checks or builds — if you ever see
`Cannot find module '@/app/generated/prisma/client'`, run `npx prisma generate`.

## 2. Environment variables

Create `.env` in the repo root (it is gitignored — `.env*` is ignored
wholesale). Every variable the code reads:

| Variable                | Required                | Read by                                                               | Purpose                                                                                                                                                    |
| ----------------------- | ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **yes**                 | `app/lib/prisma.ts`, `prisma.config.ts`                               | Postgres connection string. Passed to the `PrismaPg` driver adapter, not to the schema                                                                     |
| `AUTH_SECRET`           | **yes**                 | Auth.js internally; also used as the salt in `app/api/track/route.ts` | Signs the JWT session cookie. Generate with `openssl rand -base64 32`. **Changing it invalidates all sessions and re-salts every future visitor `ipHash`** |
| `OWNER_EMAIL`           | strongly recommended    | `app/lib/session.ts`                                                  | Comma-separated list of emails that count as the owner. If unset, the _oldest_ user account in the database is treated as the owner                        |
| `AUTH_GOOGLE_ID`        | only for Google sign-in | Auth.js `Google` provider (by convention)                             | From Google Cloud Console → Credentials                                                                                                                    |
| `AUTH_GOOGLE_SECRET`    | only for Google sign-in | same                                                                  | ditto                                                                                                                                                      |
| `NODE_ENV`              | set by tooling          | `app/lib/prisma.ts`                                                   | Non-production reuses one Prisma client across hot reloads                                                                                                 |
| `VERCEL_GIT_COMMIT_SHA` | set by Vercel           | `next.config.ts`                                                      | Sliced to 7 chars and exposed as `NEXT_PUBLIC_BUILD`, shown in `SignedInBar` so you can confirm a device loaded the latest deploy. Falls back to `"dev"`   |

Minimal local `.env`:

```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
AUTH_SECRET=<openssl rand -base64 32>
OWNER_EMAIL=you@example.com
# Optional — omit both to hide/disable Google sign-in end-to-end:
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

> The Google button is rendered unconditionally in `app/components/AuthForm.tsx`
> (line ~76). With the env vars missing, clicking it fails at the provider.
> Credentials (email + password) sign-in works without any Google setup.

## 3. Create the schema

**There is no `prisma/migrations/` directory.** `prisma.config.ts` points
`migrations.path` at `prisma/migrations`, but nothing has ever been generated
there — the schema has always been applied with `db push`:

```bash
npx prisma db push        # create/sync tables from prisma/schema.prisma
```

If you'd rather adopt real migrations, see
[08 — Operations](08-operations.md#adopting-migrations).

## 4. Bootstrap the owner account

`/api/signup` is deliberately a **one-time door**: it refuses if any `User` row
already exists ("This house isn't handing out new keys."). So on a fresh
database:

1. `npm run dev`
2. Visit <http://localhost:3000/signup>
3. Sign up with the email you put in `OWNER_EMAIL` (password ≥ 8 chars).

That account is now the owner. Signup is closed from then on. If you need a
second owner login (e.g. a Google account), add its email to the
`OWNER_EMAIL` comma-separated list and sign in with Google — Auth.js's Prisma
adapter creates the `User` row on first OAuth sign-in.

To reset: delete the `User` row (or truncate the table) and `/signup` opens
again. Note the cascade — deleting a user deletes their books, annotations and
reading progress.

## 5. Run

```bash
npm run dev          # next dev on http://localhost:3000
npm run build        # prisma generate && next build
npm start            # serve the production build
npm run lint         # eslint (flat config, eslint-config-next + prettier)
npm run format       # prettier --write .
npm run format:check # what CI runs
```

`npx tsc --noEmit` type-checks without building. Both `lint` and `tsc` are
clean as of `907c45c`.

There's also `.claude/launch.json`, a committed launch config that runs
`npm run dev` on port 3000.

## Testing on a phone / iPad over the LAN

The app is a PWA (`app/manifest.ts`) and several features were built for touch,
so LAN testing matters.

1. `next.config.ts` has `allowedDevOrigins: ["10.6.60.173"]` — **hardcoded**.
   Change it to your machine's current LAN IP or dev resources (HMR, chunks)
   will be blocked.
2. `trustHost: true` in `app/lib/auth.ts` lets sign-in work on a non-localhost
   host.
3. Visit `http://<your-lan-ip>:3000` from the device; "Add to Home Screen"
   installs it standalone.

## Troubleshooting

| Symptom                                              | Cause / fix                                                                                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cannot find module '@/app/generated/prisma/client'` | Run `npx prisma generate`                                                                                                                                                                      |
| Build fails on database access                       | Pages that read the DB call `await connection()` so they render per request and don't touch Postgres at build time. If you add a new DB-reading page, do the same — CI builds have no database |
| Everything is read-only even though you're signed in | `OWNER_EMAIL` doesn't match your account's email, or it isn't set in the deploy environment. See [03](03-auth-and-access-control.md)                                                           |
| Sessions dropped after a deploy                      | `AUTH_SECRET` changed between environments                                                                                                                                                     |
| Dev server can't be reached from a phone             | Stale IP in `allowedDevOrigins`                                                                                                                                                                |
| `prisma db push` wants to drop columns               | You're pointed at a database created from an older schema; check `DATABASE_URL` before accepting anything destructive                                                                          |
