import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isOwner } from "@/app/lib/session";
import type { Block } from "@/app/lib/article";
import RoomShell from "@/app/components/RoomShell";
import ArticleReader, { type Grasp } from "@/app/components/ArticleReader";

export const metadata: Metadata = {
  title: "reading — bahar's house",
  // The reader holds a cached copy of someone else's article; it's a private
  // desk, not a republishing of their work.
  robots: { index: false, follow: false },
};

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const [bookmark, canEdit] = await Promise.all([
    prisma.bookmark.findUnique({
      where: { id },
      include: {
        highlights: { orderBy: [{ block: "asc" }, { start: "asc" }] },
      },
    }),
    isOwner(),
  ]);
  // Reading here — and marking up — is the owner's alone.
  if (!canEdit) notFound();
  if (!bookmark) notFound();

  return (
    <RoomShell
      title="the reading desk"
      tagline="highlight as you go: green if you could explain it, amber if it's half there, red if it lost you."
      back={{ href: "/daily", label: "the daily room" }}
    >
      <ArticleReader
        bookmark={{
          id: bookmark.id,
          url: bookmark.url,
          title: bookmark.title,
          source: bookmark.source,
          byline: bookmark.byline,
          wordCount: bookmark.wordCount,
        }}
        blocks={(bookmark.blocks as Block[] | null) ?? null}
        highlights={bookmark.highlights.map((h) => ({
          id: h.id,
          block: h.block,
          start: h.start,
          end: h.end,
          quote: h.quote,
          grasp: h.grasp as Grasp,
          note: h.note,
        }))}
      />
    </RoomShell>
  );
}
