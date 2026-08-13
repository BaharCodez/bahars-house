import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isOwner } from "@/app/lib/session";
import {
  LEETCODE_SYNCED_AT,
  LEETCODE_USER,
  getSetting,
} from "@/app/lib/settings";
import RoomShell from "@/app/components/RoomShell";
import RoadmapView, { type ProblemEntry } from "@/app/components/RoadmapView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const rm = await prisma.roadmap.findUnique({
    where: { slug },
    select: { title: true },
  });
  return {
    title: rm ? `${rm.title} — bahar's house` : "roadmap — bahar's house",
    // The whole roadmaps room is owner-only — keep it out of search.
    robots: { index: false, follow: false },
  };
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const [roadmap, canEdit, drilled, lcUser, lcSyncedAt] = await Promise.all([
    prisma.roadmap.findUnique({
      where: { slug },
      include: { steps: { orderBy: { order: "asc" } } },
    }),
    isOwner(),
    // How the drilled problems went — the evidence half of the DSA board.
    prisma.problemLog.findMany({
      select: {
        url: true,
        status: true,
        auto: true,
        rating: true,
        note: true,
      },
    }),
    getSetting(LEETCODE_USER),
    getSetting(LEETCODE_SYNCED_AT),
  ]);
  // The whole roadmaps room is owner-only — others get a 404 even with the URL.
  if (!canEdit) notFound();
  if (!roadmap) notFound();

  const problemLog: Record<string, ProblemEntry> = {};
  for (const p of drilled) {
    if (p.status === "solved" || p.status === "struggled") {
      problemLog[p.url] = {
        status: p.status,
        rating: p.rating,
        note: p.note,
        auto: p.auto,
      };
    }
  }

  return (
    <RoomShell
      title={roadmap.emoji + " " + roadmap.title.toLowerCase()}
      heading={roadmap.title}
      tagline={roadmap.subtitle}
      back={{ href: "/roadmaps", label: "roadmaps" }}
    >
      <RoadmapView
        steps={roadmap.steps}
        canEdit={canEdit}
        slug={roadmap.slug}
        problemLog={problemLog}
        leetcode={{ username: lcUser, syncedAt: lcSyncedAt }}
      />
    </RoomShell>
  );
}
