import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { articleOfTheDay } from "@/app/lib/feeds";
import { listeningOfTheDay, sceneOfTheDay } from "@/app/lib/spanish";
import { isOwner } from "@/app/lib/session";
import RoomShell from "@/app/components/RoomShell";
import DailyRoom from "@/app/components/DailyRoom";
import type { Grasp } from "@/app/components/ArticleReader";

export const metadata: Metadata = {
  title: "the daily room — bahar's house",
  description:
    "One engineering article and one sip of conversational Spanish, every day.",
};

function serverDay() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default async function DailyPage() {
  // Render per request — today's date, ticks, and the feed pool all move,
  // and CI builds have no database.
  await connection();
  const day = serverDay();
  const [article, ticks, bookmarks, canEdit, graspRows] = await Promise.all([
    articleOfTheDay(day).catch(() => null),
    prisma.dailyTick.findMany({
      orderBy: { day: "desc" },
      take: 400,
      select: { kind: true, day: true },
    }),
    prisma.bookmark.findMany({
      orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        url: true,
        title: true,
        source: true,
        favorite: true,
        shelf: true,
        fetchedAt: true,
      },
    }),
    isOwner(),
    // How each shelved read landed, counted per article.
    prisma.highlight.groupBy({
      by: ["bookmarkId", "grasp"],
      _count: { _all: true },
    }),
  ]);

  // The running "what I don't get yet" pile across every read on the shelf.
  const fuzzy = canEdit
    ? await prisma.highlight.findMany({
        where: { grasp: { in: ["half", "lost"] } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          quote: true,
          note: true,
          grasp: true,
          bookmark: { select: { id: true, title: true } },
        },
      })
    : [];

  // Reading notes are the owner's own; visitors just see the shelf.
  const marks: Record<string, Record<Grasp, number>> = {};
  for (const row of canEdit ? graspRows : []) {
    const counts = (marks[row.bookmarkId] ??= { got: 0, half: 0, lost: 0 });
    if (row.grasp === "got" || row.grasp === "half" || row.grasp === "lost") {
      counts[row.grasp] = row._count._all;
    }
  }

  return (
    <RoomShell
      title="the daily room"
      heading="The Daily Room"
      tagline="one article, one sip of spanish, small every day"
      image={{
        src: "https://images.unsplash.com/photo-1677846092922-5b685ba0afb2?w=1200&h=400&fit=crop&auto=format",
        alt: "A cup of coffee and a book on a windowsill",
      }}
    >
      <DailyRoom
        article={article}
        scene={sceneOfTheDay(day)}
        listening={listeningOfTheDay(day)}
        ticks={ticks}
        bookmarks={bookmarks.map((b) => ({
          ...b,
          pulledIn: b.fetchedAt !== null,
        }))}
        marks={marks}
        fuzzy={fuzzy.map((h) => ({
          id: h.id,
          quote: h.quote,
          note: h.note,
          grasp: h.grasp as Grasp,
          bookmarkId: h.bookmark.id,
          bookmarkTitle: h.bookmark.title,
        }))}
        canEdit={canEdit}
        serverDay={day}
      />
    </RoomShell>
  );
}
