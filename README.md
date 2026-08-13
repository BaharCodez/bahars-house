# bahar's house

A personal site laid out as rooms of a house: a portfolio wall, a writing room,
a study with an EPUB reader, a daily room with a reading desk, owner-only
learning roadmaps, and a workshop. Installable as a PWA.

The repo is still named `social-reading-app` and started life as "The Same Page",
a shared EPUB reading app — that machinery is still here and still works, but the
product on top of it is single-owner: **anyone may look at the house, only the
owner may change it.**

📚 **Full engineering documentation lives in [`docs/`](docs/README.md).**

## Quick start

```bash
npm install                # runs prisma generate
cp /dev/null .env          # then fill it in (see below)
npx prisma db push         # create the schema
npm run dev                # http://localhost:3000
```

On a fresh database, visit `/signup` once to create the owner account — the
signup door closes as soon as one user exists.

```bash
# .env
DATABASE_URL=postgresql://…
AUTH_SECRET=…              # openssl rand -base64 32
OWNER_EMAIL=you@example.com
AUTH_GOOGLE_ID=…           # optional
AUTH_GOOGLE_SECRET=…       # optional
```

Details, troubleshooting and LAN/phone testing: [docs/01 — Setup](docs/01-setup.md).

## Stack

- **Next.js 16** (App Router, server components) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** (config in CSS, 7 swappable themes)
- **PostgreSQL** (Neon) via **Prisma 7** with the `@prisma/adapter-pg` driver adapter
- **Auth.js 5 (beta)** — Google OAuth + credentials, JWT sessions
- **Zod 4** on every request body
- `epubjs` (reader), `@mozilla/readability` + `linkedom` (article extraction),
  `marked` (post rendering)

## Scripts

| Command                           | Description                          |
| --------------------------------- | ------------------------------------ |
| `npm run dev`                     | Dev server                           |
| `npm run build`                   | `prisma generate` + production build |
| `npm start`                       | Serve the production build           |
| `npm run lint`                    | ESLint                               |
| `npm run format` / `format:check` | Prettier                             |

CI (`.github/workflows/ci.yml`) runs lint → format check → build on Node 22.
There are no tests.

## Documentation index

| Doc                                                              | Contents                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [01 — Setup](docs/01-setup.md)                                   | Install, env vars, database bootstrap, troubleshooting                     |
| [02 — Architecture](docs/02-architecture.md)                     | App Router layout, rendering strategy, data flow                           |
| [03 — Auth & access control](docs/03-auth-and-access-control.md) | The owner model and how "public can't edit" is enforced                    |
| [04 — Data model](docs/04-data-model.md)                         | All 20 Prisma models, field by field                                       |
| [05 — API reference](docs/05-api-reference.md)                   | All 23 route handlers                                                      |
| [06 — UI & theming](docs/06-ui-and-styling.md)                   | Rooms, themes, CSS tokens, component inventory                             |
| [07 — Feature deep dives](docs/07-features.md)                   | EPUB reader, reading desk, roadmaps/DSA/LeetCode, daily room, writing room |
| [08 — Operations](docs/08-operations.md)                         | CI, deploy, schema changes, seeding, backups                               |
| [09 — Gotchas](docs/09-gotchas.md)                               | Dead code, sharp edges, limits                                             |

## Deployment

Vercel (zero-config) + Neon Postgres. Set `DATABASE_URL`, `AUTH_SECRET` and
`OWNER_EMAIL` in the Vercel project — without `OWNER_EMAIL` the owner check falls
back to "oldest account in the database". See
[docs/08 — Operations](docs/08-operations.md).
