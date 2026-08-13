# 06 — UI, theming & components

## Page map

| Route               | File                           | Access               | Renders                                                                                                                                                            |
| ------------------- | ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                 | `app/page.tsx`                 | 🌐                   | The hallway: intro copy + one card per room. Hand-drawn `<Leaf>` SVGs. Redirects legacy `/?book=<id>` → `/study?book=<id>`. Hides the Roadmaps card for non-owners |
| `/hallway`          | `app/hallway/page.tsx`         | 🌐                   | "My Portfolio" — `Frame` rows where `kind != "sandbox"`, via `HallwayWall`. Has its own inline banner rather than `RoomShell`                                      |
| `/notes`            | `app/notes/page.tsx`           | 🌐                   | Writing room index: tag filter, 12-per-page pagination, three piles behind dividers — finished essays, "learning"-tagged notes, then drafts                        |
| `/notes/[id]`       | `app/notes/[id]/page.tsx`      | 🌐                   | One post. `marked.parse(content, { breaks: true })` into `.article` typography. Cover image, date/draft badge, read time, tag chips                                |
| `/notes/write`      | `app/notes/write/page.tsx`     | 🌐 page, 🔒 saving   | `PostEditor` (create, or edit with `?id=`). Pre-loads all existing tags for suggestions                                                                            |
| `/notes/board`      | `app/notes/board/page.tsx`     | 🌐                   | The hobby corkboard — `IdeaBoard` over four buckets                                                                                                                |
| `/study`            | `app/study/page.tsx`           | 🌐                   | `ReaderApp`: upload dropzone → library grid → EPUB reader. The only room that's client-state-driven rather than server-rendered                                    |
| `/daily`            | `app/daily/page.tsx`           | 🌐 (owner sees more) | `DailyRoom`: article of the day, Spanish scene, listening, streak board, article shelf. Grasp counts and the "what I don't get yet" pile render only for the owner |
| `/daily/read/[id]`  | `app/daily/read/[id]/page.tsx` | 🔒 (404)             | The reading desk — `ArticleReader` over a pulled-in article. `robots: noindex`                                                                                     |
| `/roadmaps`         | `app/roadmaps/page.tsx`        | 🔒 (404)             | Roadmap index with progress bars. `robots: noindex`                                                                                                                |
| `/roadmaps/[slug]`  | `app/roadmaps/[slug]/page.tsx` | 🔒 (404)             | `RoadmapView`: grouped steps, recall prompts, DSA templates/visualisations, strong-weak board, LeetCode sync                                                       |
| `/workshop`         | `app/workshop/page.tsx`        | 🌐                   | ESP32 "mission control" placeholder tiles (all in a no-device-yet state) + `WorkshopShelf` of `kind: "sandbox"` frames                                             |
| `/visitors`         | `app/visitors/page.tsx`        | 🔒 (404)             | Analytics: totals, top countries/pages/referrers, last 120 visits. Opened by the Konami code                                                                       |
| `/login`, `/signup` |                                | 🌐                   | `AuthForm`. Both redirect to `/study` if already signed in                                                                                                         |

## Layout chrome

`app/layout.tsx` (async server component):

1. Loads **7 Google fonts** via `next/font/google`, each exposing a CSS variable:
   Geist (`--font-geist-sans`), Geist Mono (`--font-geist-mono`), Fraunces
   (`--font-fraunces`), Pixelify Sans (`--font-pixel`), Lora
   (`--font-lora`, normal + italic), Instrument Sans (`--font-instrument`),
   Courier Prime (`--font-courier`, 400/700).
2. Injects an inline `<script>` in `<head>` that sets
   `document.documentElement.dataset.theme` from `localStorage` **before paint**
   (no theme flash). Defaults to `cottage`. `suppressHydrationWarning` on `<html>`.
3. `const owner = await isOwner()` → `<Sidebar isOwner={owner} />`.
4. Wraps everything in `Providers` (just Auth.js `SessionProvider`).
5. `<main className="flex min-h-screen flex-col pt-14 md:ml-56 md:pt-0">` — the
   sidebar is a fixed 14rem rail on `md+` and a top bar below that.
6. Mounts `VisitTracker` (analytics ping) and `SecretDoor` (Konami listener).

Metadata: title "bahar's house", `appleWebApp.capable` for standalone iOS,
`viewport.interactiveWidget: "resizes-content"` so Android shrinks the layout
for the keyboard instead of overlaying it (iOS ignores it — `Reader` lifts its
note sheet manually).

### `RoomShell` / `RoomBanner` (the only server components in `components/`)

`RoomShell({ title, heading?, tagline?, image?, back?, children })` is the shared
room chrome. With an `image` it renders `RoomBanner` — a lazy-loaded photo with
`filter: sepia(28%) saturate(82%) brightness(0.96)`, a gradient fade into
`var(--bg)`, and an overlaid typewriter eyebrow + serif heading. Without one it
falls back to a plain text header. `back` renders a `← label` link.

Banner images are **hot-linked Unsplash URLs** with `?w=1200&h=400&fit=crop`
(see [09](09-gotchas.md)).

## The theme system

Seven themes, defined twice and joined by id — keep both sides in sync:

| id          | Label      | Swatch    | Character                               |
| ----------- | ---------- | --------- | --------------------------------------- |
| `cottage`   | Cottage    | `#3d5a3e` | **Default.** Parchment, moss, ink-brown |
| `meadow`    | Meadow     | `#788a4f` | Moss + terracotta                       |
| `plantshop` | Plant Shop | `#6f8f4f` | The original pixel-art look             |
| `sepia`     | Sepia      | `#a9713f` |                                         |
| `cabin`     | Cabin      | `#cf9b53` | Walnut, amber lamplight                 |
| `twilight`  | Twilight   | `#d98a52` | Dusky plum, sunset rust                 |
| `forest`    | Forest     | `#5c7a48` |                                         |

- **`app/lib/themes.ts`** — `THEMES` array (`id`, `label`, `swatch`) + `DEFAULT_THEME`.
- **`app/globals.css`** — a `[data-theme="<id>"]` block per theme setting 11 CSS
  custom properties.

### The 11 palette variables

`--bg`, `--bg-2`, `--surface`, `--ink`, `--ink-soft`, `--line`, `--accent`,
`--accent-ink` (text on accent), `--accent-2` (mono labels), `--shelf`,
`--shelf-edge` (the bookshelf woodwork).

They're exposed to Tailwind through `@theme inline`, so utility classes work
directly:

```css
@theme inline {
  --color-bg: var(--bg);
  --color-bg-2: var(--bg-2);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-accent-ink: var(--accent-ink);
  --color-accent-2: var(--accent-2);
  --color-shelf: var(--shelf);
  --color-shelf-edge: var(--shelf-edge);
  --font-sans: var(--font-instrument), var(--font-geist-sans);
  --font-mono: var(--font-courier), var(--font-geist-mono);
  --font-serif: var(--font-lora), var(--font-fraunces);
}
```

So `text-ink`, `bg-surface`, `border-line`, `text-accent-2`, `font-serif`,
`font-mono` all theme themselves. **There is no `tailwind.config.js`** — Tailwind
4 config lives in CSS.

`ThemePicker` reads the current value off `document.documentElement.dataset.theme`
on mount (inside a `requestAnimationFrame` so it doesn't fight the pre-paint
script), writes both the dataset and `localStorage["theme"]` on change, and
positions its menu `fixed` so a scrollable bar can't clip it. It appears in the
sidebar, the reader, and the auth form.

### Theme-conditional styling

Two mechanisms worth knowing:

```css
.font-pixel {
  font-family: var(--font-courier), …;
} /* cottage default */
[data-theme="plantshop"] .font-pixel {
  font-family: var(--font-pixel), …;
}
[data-theme="plantshop"] .font-serif {
  font-family: var(--font-pixel), …;
}

.plant-decor {
  display: none;
}
[data-theme="plantshop"] .plant-decor {
  display: …;
} /* plant art only there */
```

`.pixel-frame` is a soft parchment card by default and a chunky pixel border
under `plantshop`. So "pixel house" styling is now opt-in via one theme.

### Animations (all in `globals.css`, all honouring `prefers-reduced-motion`)

- Cottage: `cottage-sway` → `.sway`, `cottage-drift` → `.drift`,
  `cottage-fade-up` → `.fade-up` (the page-enter animation used on nearly every room).
- DSA visualisations: `dsa-window`, `dsa-ptr-l`, `dsa-ptr-r`, `dsa-glow`,
  `dsa-dim`, `dsa-dot`, `dsa-grow`, `dsa-fill`, driven through `.dsa-anim`.
- `ticker-scroll` → `.ticker-track` (writing-room marquee; the track holds two
  copies of the content).
- Den leftovers: `walk-bob`, `firefly`, `steam-rise` (used only by the unused
  `DenGame`).

### Long-form typography

- **`.article`** — rendered markdown for posts: headings, paragraph rhythm,
  links, images, blockquotes, lists, inline `code`, `pre` blocks, `hr`.
- **`.reader-body`** — the reading desk's article body.
- **`.touch-scroll`** — iOS momentum scrolling, hidden scrollbars.
- **`.epub-container`** — epub.js's scroll container: momentum scrolling plus
  `overscroll-behavior: contain` so chapter-edge over-scroll doesn't rubber-band
  the app shell or trigger pull-to-refresh.
- Highlight tints `hl-got` / `hl-half` / `hl-lost` double as the DSA board's
  strong/shaky/weak tints (`BAND_TINT` in `app/lib/dsaStrength.ts`).

## Component inventory

Server components: **`RoomShell`**, **`RoomBanner`**. Everything else is
`"use client"`.

### Chrome & global

| Component      | Notes                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar`      | Fixed rail on `md+`, collapsible top bar on mobile. `ROOMS` array with `ownerOnly` flags; active state via `usePathname`. Decorative `<Fern>` SVG. Hosts `ThemePicker` + `AmbientMusic`           |
| `Providers`    | Auth.js `SessionProvider` only                                                                                                                                                                    |
| `ThemePicker`  | See above                                                                                                                                                                                         |
| `AmbientMusic` | **One module-level `<audio>`** (`/music/cozy-lounge.mp3`, `loop`, volume 0.45) shared across the whole site, so music survives client-side navigation and every ♪ button controls the same player |
| `VisitTracker` | POSTs `/api/track` on each pathname change, `keepalive`, errors swallowed                                                                                                                         |
| `SecretDoor`   | Konami code `↑↑↓↓←→←→BA` → `router.push("/visitors")`                                                                                                                                             |
| `SignedInBar`  | Signed-in identity + sign-out; shows `NEXT_PUBLIC_BUILD` so you can confirm a device has the latest deploy                                                                                        |
| `AuthForm`     | `mode: "login" \| "signup"`. Credentials form + "Continue with Google"                                                                                                                            |

### Study / reading

| Component        | Notes                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ReaderApp`      | Orchestrator: library state, `?book=`/`?loc=` deep links, `localStorage["lastBook"]`, upload flow with iCloud retry |
| `Library`        | Bookshelf grid                                                                                                      |
| `UploadDropzone` | Empty-library state                                                                                                 |
| `Reader`         | **1079 lines** — the epub.js integration. See [07](07-features.md)                                                  |
| `CoverPicker`    | Croppable cover image chooser for posts (uploads via `/api/images`)                                                 |

### Rooms

| Component                | Notes                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `DailyRoom` (804)        | Daily room: habit ticks, article shelf, shelves, fuzzy pile                                |
| `ArticleReader` (770)    | The reading desk. Exports `Grasp` and `Highlight` types used by pages                      |
| `HallwayWall` (433)      | Portfolio wall + inline frame editor (POST/PATCH/DELETE `/api/frames`)                     |
| `WorkshopShelf` (309)    | Sandbox-project shelf, same frame editor pattern                                           |
| `IdeaBoard` (201)        | Four-bucket corkboard                                                                      |
| `PostEditor` (513)       | Markdown editor: title, `TagInput`, `CoverPicker`, image upload, draft/publish, delete     |
| `TagInput` (119)         | Tag chips with suggestions from existing post tags                                         |
| `RoadmapView` (624)      | Steps grouped by `group`, recall prompts, per-pattern template/problems, confidence rating |
| `DsaStrengthBoard` (146) | Strong/weak board over `app/lib/dsaStrength.ts`; hosts `LeetCodeSync`                      |
| `LeetCodeSync` (226)     | Link/unlink a handle, run a sync, report `added` + `offBoard`                              |
| `PatternViz` (210)       | Animated DSA pattern diagrams, switched on `dsaContent`'s `viz` key                        |

### Unused (dead code)

`DenGame` (712 lines) and `IntruderAlarm` (94) — leftovers from the removed
"den" room. `DenGame` still imports the `Frame` type from `HallwayWall`. Nothing
routes to either. See [09](09-gotchas.md).

## Static assets (`public/`)

- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — PWA/iOS icons
- `music/cozy-lounge.mp3` — the ambient track
- `decor/plants/plant-1…8.png`, `decor/plantshelf.png`, `decor/gardener.png`,
  `ShelfWornDrawn.jpeg` — pixel-house art (mostly `plantshop`/den era)
- `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — create-next-app leftovers

`design-inspo/` is gitignored except its README — reference images only, not app
assets.
