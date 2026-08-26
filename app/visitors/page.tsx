import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isOwner } from "@/app/lib/session";

export const metadata: Metadata = {
  title: "visitors — bahar's house",
  robots: { index: false, follow: false },
};

// ISO-2 country code → flag emoji.
function flag(cc: string): string {
  if (!cc || cc.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0)),
  );
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="border-line bg-surface rounded-sm border p-4 text-center">
      <div className="text-ink font-serif text-3xl">{n}</div>
      <div className="text-ink-soft mt-1 font-mono text-[11px] tracking-wide uppercase">
        {label}
      </div>
    </div>
  );
}

function List({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; n: number }[];
}) {
  return (
    <div>
      <h2 className="text-accent-2 mb-3 font-mono text-xs tracking-[0.2em] uppercase">
        {title}
      </h2>
      <div className="space-y-1.5">
        {rows.length === 0 && (
          <p className="text-ink-soft text-sm italic">nothing yet</p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="text-ink min-w-0 flex-1 truncate">{r.label}</span>
            <span className="text-accent-2 shrink-0 font-mono text-xs font-bold">
              {r.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// One screenful of history at a time — the log grows forever, so never render
// all of it. Older visits are reachable via ?page=.
const PER_PAGE = 50;

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();
  // Hidden + owner-only: even with the URL, non-owners get a 404.
  if (!(await isOwner())) notFound();

  const page = Math.max(
    1,
    Number.parseInt((await searchParams).page ?? "1", 10) || 1,
  );
  const skip = (page - 1) * PER_PAGE;

  const [total, recent, totals, byCountry, byPage, byRef] = await Promise.all([
    prisma.visit.count(),
    prisma.visit.findMany({
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip,
    }),
    // Counted in the database — pulling every distinct ipHash into the page
    // grew with the visitor log and would eventually time out.
    prisma.$queryRaw<{ visitors: bigint; countries: bigint }[]>`
      SELECT COUNT(DISTINCT NULLIF("ipHash", '')) AS visitors,
             COUNT(DISTINCT NULLIF("country", '')) AS countries
      FROM "Visit"
    `,
    prisma.visit.groupBy({
      by: ["country"],
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 8,
    }),
    prisma.visit.groupBy({
      by: ["path"],
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 8,
    }),
    prisma.visit.groupBy({
      by: ["referrer"],
      where: { referrer: { not: "" } },
      _count: { _all: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 8,
    }),
  ]);

  const uniqueCount = Number(totals[0]?.visitors ?? 0);
  const countryCount = Number(totals[0]?.countries ?? 0);
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="fade-up mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
      <span className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
        🔓 the secret room
      </span>
      <h1 className="text-ink mt-1 font-serif text-4xl">Visitors</h1>
      <p className="text-ink-soft mt-2 text-sm">
        Just for your eyes — coarse location, referrer and device only. Your own
        visits aren&apos;t logged.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <Stat n={total} label="page views" />
        <Stat n={uniqueCount} label="unique visitors" />
        <Stat n={countryCount} label="countries" />
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        <List
          title="top countries"
          rows={byCountry.map((c) => ({
            label: `${flag(c.country)} ${c.country || "unknown"}`,
            n: c._count._all,
          }))}
        />
        <List
          title="top pages"
          rows={byPage.map((p) => ({ label: p.path, n: p._count._all }))}
        />
        <List
          title="came from"
          rows={byRef.map((r) => ({ label: r.referrer, n: r._count._all }))}
        />
      </div>

      <div className="mt-12 mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
          recent visits
        </h2>
        <span className="text-ink-soft font-mono text-[11px]">
          {total > 0 &&
            `${skip + 1}–${Math.min(skip + PER_PAGE, total)} of ${total}`}
        </span>
      </div>
      <div className="border-line divide-line divide-y rounded-sm border">
        {recent.length === 0 && (
          <p className="text-ink-soft p-4 text-sm italic">
            {total === 0
              ? "No visits logged yet. Share the link and watch them roll in."
              : "Nothing on this page — you've reached the end of the log."}
          </p>
        )}
        {recent.map((v) => (
          <div
            key={v.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
          >
            <span className="text-ink w-40 shrink-0">
              {flag(v.country)}{" "}
              {[v.city, v.country].filter(Boolean).join(", ") || "unknown"}
            </span>
            <span className="text-accent font-mono text-xs">{v.path}</span>
            <span className="text-ink-soft ml-auto font-mono text-xs">
              {v.referrer ? `via ${v.referrer}` : "direct"} · {v.device} ·{" "}
              {timeAgo(v.createdAt)}
            </span>
          </div>
        ))}
      </div>

      {lastPage > 1 && (
        <nav className="mt-4 flex items-center justify-between font-mono text-xs">
          {page > 1 ? (
            <Link
              href={page === 2 ? "/visitors" : `/visitors?page=${page - 1}`}
              className="text-accent-2 hover:underline"
            >
              ← newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-soft">
            page {page} of {lastPage}
          </span>
          {page < lastPage ? (
            <Link
              href={`/visitors?page=${page + 1}`}
              className="text-accent-2 hover:underline"
            >
              older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
