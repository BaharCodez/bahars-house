import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/app/lib/prisma";
import RoomShell from "@/app/components/RoomShell";
import { readingStats } from "@/app/lib/reading";

export const metadata: Metadata = {
  title: "writing room — bahar's house",
  description: "Notes on what I'm reading and what I'm building.",
};

/* Evergreen topics — writing done purely to learn (study notes, exercises).
   These sink below the dated essays regardless of when they were written. */
const EVERGREEN_TAGS = new Set(["learning"]);

function isEvergreen(tags: string[]): boolean {
  return tags.some((t) => EVERGREEN_TAGS.has(t.toLowerCase()));
}

/* Which pile an entry falls in. The room opens on finished writing, so the
   dated essays come first, then the evergreen learning pile, then anything
   still unpublished. */
function rank(post: { tags: string[]; publishedAt: Date | null }): number {
  if (!post.publishedAt) return 2;
  return isEvergreen(post.tags) ? 1 : 0;
}

/* Section headings, shown at the first entry of each pile below the first. */
const SECTIONS = [
  { rank: 1, label: "learning notes" },
  { rank: 2, label: "drafts" },
];

/* The first embedded image, used as the card's cover. */
function firstImage(md: string): string | null {
  const m = md.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  return m ? m[1] : null;
}

function stamp(date: Date) {
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  // Render per request — entries change, and CI builds have no database.
  await connection();
  const { tag, page } = await searchParams;
  const active = tag?.trim().toLowerCase() || null;

  const posts = await prisma.post.findMany({
    // Published newest first; drafts (no publishedAt) fall to the end, most
    // recently touched first — the one you were last working on.
    orderBy: [
      { publishedAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      coverImage: true,
      publishedAt: true,
    },
  });

  // Topic index across every entry, most-used first — the reuse menu.
  const counts = new Map<string, { tag: string; count: number }>();
  for (const post of posts) {
    for (const t of post.tags) {
      const key = t.toLowerCase();
      const seen = counts.get(key);
      if (seen) seen.count += 1;
      else counts.set(key, { tag: t, count: 1 });
    }
  }
  const topics = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  );
  const activeLabel = active ? (counts.get(active)?.tag ?? active) : null;

  const filtered = active
    ? posts.filter((p) => p.tags.some((t) => t.toLowerCase() === active))
    : posts;

  // Finished essays, then evergreen "learning" notes, then drafts (a stable
  // sort keeps the date order within each pile).
  const shown = [...filtered].sort((a, b) => rank(a) - rank(b));

  // Paginate: 12 entries a page, in that pile order.
  // 12 fills the 2- and 3-column grid evenly (no orphan row) and keeps each
  // page a quick scroll. Bump it if the room gets busy.
  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(
    Math.max(1, Math.trunc(Number(page)) || 1),
    totalPages,
  );
  const start = (current - 1) * PAGE_SIZE;
  const pageItems = shown.slice(start, start + PAGE_SIZE);

  // Where each pile starts globally, mapped onto this page so a heading lands
  // wherever that boundary actually falls. Skipped when filtering to one
  // topic, and when a pile opens the list (nothing above it to divide from).
  const dividers = new Map<number, string>();
  if (!active) {
    for (const section of SECTIONS) {
      const at = shown.findIndex((p) => rank(p) === section.rank);
      if (at > 0 && at >= start && at < start + PAGE_SIZE) {
        dividers.set(at - start, section.label);
      }
    }
  }

  // Page links preserve the active topic; page 1 drops the ?page param.
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (activeLabel) params.set("tag", activeLabel);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/notes?${qs}` : "/notes";
  };

  return (
    <RoomShell
      title="writing room"
      heading="The Writing Room"
      image={{
        src: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=1200&h=400&fit=crop&auto=format",
        alt: "An open notebook and pen on a desk",
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
        {/* intro + actions, aligned with the grid below */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-soft text-base leading-relaxed">
            notes, learning &amp; essays
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/notes/board"
              className="border-line text-ink hover:bg-accent/10 bg-surface rotate-2 rounded-sm border px-3 py-2 text-xs font-medium shadow-[3px_4px_0_rgba(42,31,14,0.1)] transition-all hover:rotate-0"
            >
              📌 the hobby board
            </Link>
            <Link
              href="/notes/write"
              className="bg-accent text-accent-ink font-pixel rounded-full px-4 py-1.5 text-xs hover:opacity-90"
            >
              ✎ write something
            </Link>
          </div>
        </div>

        {/* topics filter — reuse a tag by clicking it */}
        {topics.length > 0 && (
          <div className="border-line mb-8 flex flex-wrap items-center gap-2 border-y py-3">
            <span className="text-ink-soft/60 mr-1 font-mono text-xs tracking-[0.2em] uppercase">
              topics
            </span>
            <Link
              href="/notes"
              className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                active
                  ? "text-ink-soft hover:text-ink"
                  : "bg-accent text-accent-ink"
              }`}
            >
              all
            </Link>
            {topics.map((t) => {
              const on = t.tag.toLowerCase() === active;
              return (
                <Link
                  key={t.tag}
                  href={`/notes?tag=${encodeURIComponent(t.tag)}`}
                  className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                    on
                      ? "bg-accent text-accent-ink"
                      : "bg-accent/10 text-ink hover:bg-accent/20"
                  }`}
                >
                  {t.tag}
                  <span className="opacity-50"> · {t.count}</span>
                </Link>
              );
            })}
          </div>
        )}

        {activeLabel && (
          <p className="text-ink-soft mb-6 text-sm">
            Showing{" "}
            <span className="text-ink font-semibold">{shown.length}</span> entr
            {shown.length === 1 ? "y" : "ies"} tagged{" "}
            <span className="text-ink font-semibold">{activeLabel}</span>.
          </p>
        )}

        {/* entries grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-3 lg:gap-x-8">
          {pageItems.map((post, i) => {
            const cover = post.coverImage ?? firstImage(post.content);
            const { minutes } = readingStats(post.content);
            const href = post.publishedAt
              ? `/notes/${post.id}`
              : `/notes/write?id=${post.id}`;
            const label = dividers.get(i);
            const divider = label ? (
              <div
                key="section-divider"
                className="col-span-full mt-2 flex items-center gap-3"
              >
                <span className="text-ink-soft/60 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                  {label}
                </span>
                <span className="border-line flex-1 border-t" />
              </div>
            ) : null;
            return (
              <Fragment key={post.id}>
                {divider}
                <article className="group flex flex-col">
                  <Link href={href} className="block">
                    {cover ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="border-line aspect-[3/2] w-full rounded-md border object-cover"
                      />
                    ) : (
                      <div className="border-line bg-accent/8 flex aspect-[3/2] w-full items-center justify-center rounded-md border">
                        <span className="text-accent/30 font-serif text-4xl italic">
                          {post.title.trim().charAt(0).toUpperCase() || "✎"}
                        </span>
                      </div>
                    )}
                  </Link>

                  <div className="text-ink-soft/70 mt-2.5 flex items-center gap-2 font-mono text-[0.65rem] tracking-wider">
                    <span className="text-accent-2">
                      {post.publishedAt ? stamp(post.publishedAt) : "DRAFT"}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{minutes} min</span>
                  </div>

                  <h3 className="text-ink mt-1 font-serif text-base leading-snug font-bold">
                    <Link
                      href={href}
                      className="group-hover:text-accent underline-offset-4 transition-colors group-hover:underline"
                    >
                      {post.title}
                    </Link>
                  </h3>

                  {post.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                      {post.tags.map((t) => (
                        <Link
                          key={t}
                          href={`/notes?tag=${encodeURIComponent(t)}`}
                          className="text-ink-soft/70 hover:text-accent font-mono text-[0.65rem] transition-colors"
                        >
                          #{t}
                        </Link>
                      ))}
                    </div>
                  )}
                </article>
              </Fragment>
            );
          })}
        </div>

        {shown.length === 0 && (
          <p className="text-ink-soft py-6 text-center text-sm">
            {active
              ? "No entries under this topic yet."
              : "Nothing written yet — the first entry is waiting."}
          </p>
        )}

        {totalPages > 1 && (
          <nav className="border-line mt-12 flex items-center justify-between border-t pt-5 font-mono text-xs">
            {current > 1 ? (
              <Link
                href={pageHref(current - 1)}
                className="text-ink hover:text-accent transition-colors"
              >
                ← newer
              </Link>
            ) : (
              <span className="text-ink-soft">← newer</span>
            )}
            <span className="text-ink-soft/70 tracking-wider">
              page {current} of {totalPages}
            </span>
            {current < totalPages ? (
              <Link
                href={pageHref(current + 1)}
                className="text-ink hover:text-accent transition-colors"
              >
                older →
              </Link>
            ) : (
              <span className="text-ink-soft">older →</span>
            )}
          </nav>
        )}
      </div>
    </RoomShell>
  );
}
