import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isOwner } from "@/app/lib/session";
import HallwayWall from "@/app/components/HallwayWall";

export const metadata: Metadata = {
  title: "my portfolio — bahar's house",
  description: "Projects, jobs, and achievements.",
};

export default async function GalleryPage() {
  // Render per request — the wall changes, and CI builds have no database.
  await connection();
  const [frames, canEdit] = await Promise.all([
    prisma.frame.findMany({
      // sandbox builds live on the workshop shelf, not the gallery wall
      where: { kind: { not: "sandbox" } },
      orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kind: true,
        title: true,
        subtitle: true,
        detail: true,
        years: true,
        link: true,
        tags: true,
      },
    }),
    isOwner(),
  ]);

  return (
    <div className="fade-up flex flex-1 flex-col">
      {/* Botanical image header, study-style. */}
      <div
        className="border-line relative h-44 overflow-hidden border-b sm:h-56"
        style={{ backgroundColor: "var(--bg-2)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma-home/welcome-5.png"
          alt="A glowing wireframe carnation on a dark specimen sheet"
          loading="lazy"
          className="h-full w-full object-cover object-[50%_26%]"
          style={{ filter: "sepia(30%) saturate(85%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "var(--photo-wash)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 35%, var(--bg) 100%)",
          }}
        />
        <div className="absolute bottom-5 left-6 sm:left-8">
          <span className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
            my portfolio
          </span>
          <h1 className="text-ink mt-1 font-serif text-3xl sm:text-4xl">
            My Portfolio
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-6 pt-6 sm:px-8">
        <p className="text-ink-soft text-base leading-relaxed">
          The things I&apos;ve built, the jobs I&apos;ve done, and a few wins
          worth framing.
        </p>
      </div>

      <HallwayWall frames={frames} canEdit={canEdit} />
    </div>
  );
}
