# Bahar's House

A Next.js app with Prisma and PostgreSQL.

## Environment

Create `.env.local` in the project root, next to `package.json` and `prisma.config.ts` (not inside the `prisma` folder):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE/GoodTryOfficer"
AUTH_SECRET="generate-a-random-secret"
```

Generate `AUTH_SECRET` once by running this in any terminal (PowerShell, bash or zsh):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

You can reuse the same `.env.local` on another machine. Never commit it.

## Setup

This project uses Node.js `24.21.0` and requires `20.19.0` or newer. The version is recorded in `.nvmrc`.

With `nvm`:

```bash
# Install nvm first if the `nvm` command is not available:
# https://github.com/nvm-sh/nvm#installing-and-updating
nvm install
nvm use
node --version  # should print v24.21.0
```

After installing nvm, reload your shell profile (`~/.bashrc` on Linux, `~/.zshrc` on Mac, `$PROFILE` in PowerShell) or open a new terminal.

Without `nvm`, install Node.js 20.19 or newer and check it with `node --version`.

Install dependencies (this also generates the Prisma Client):

```bash
npm ci
```

`npm ci` rejects unsupported Node versions. The `dev`, `build`, `start` and Prisma commands also stop with a clear error if Node is too old.

## Database

Migrations are only needed for a new or out-of-date database. Check first:

```bash
npx prisma migrate status
```

If it is behind, apply the missing migrations:

```bash
npx prisma migrate deploy
```

Use `npm run migrate` (`prisma migrate dev`) only when creating a new migration on a development database. It can reset the database if it detects drift.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Pages auto-update as you edit files, starting with `app/page.tsx`.
