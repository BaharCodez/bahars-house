import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isOwner, requireOwner } from "@/app/lib/session";
import { emptyResponse, readJson } from "@/app/lib/routeHelpers";

// Roadmap steps that link into a given book, so the reader can auto-tick each
// section as it's read. Owner-only: it's Bahar's progress and only she can
// change it — visitors get an empty list and never write (see AGENTS.md).

type ReadingStep = { id: string; done: boolean; loc: string };

export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/roadmap-steps/for-book/[bookId]">,
) {
  // Non-owners simply don't track — hand back nothing rather than a 401.
  if (!(await isOwner())) return NextResponse.json([]);

  const { bookId } = await params;
  const steps = await prisma.roadmapStep.findMany({
    where: { link: linksIntoBook(bookId) },
    select: { id: true, link: true, done: true },
  });
  const readingSteps = steps
    .map((s) => ({ id: s.id, done: s.done, loc: locFromLink(s.link) }))
    .filter((s): s is ReadingStep => !!s.loc);
  return NextResponse.json(readingSteps);
}

export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/roadmap-steps/for-book/[bookId]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { bookId } = await params;
  const body = (await readJson(req)) as { doneIds?: unknown } | null;
  const doneIds = body?.doneIds;
  if (!isStringArray(doneIds)) return emptyResponse(400);

  // Reading only ever adds progress — tick, never untick. Scope the update to
  // this book so a stray id can't flip a step on some other roadmap.
  await prisma.roadmapStep.updateMany({
    where: { id: { in: doneIds }, link: linksIntoBook(bookId) },
    data: { done: true },
  });
  return NextResponse.json({ ok: true });
}

function linksIntoBook(bookId: string) {
  return { contains: `book=${bookId}` };
}

// Pull the EPUB href out of a step's link, e.g.
// "/study?book=<id>&loc=ch01.html%23sec" -> "ch01.html#sec".
function locFromLink(link: string | null): string | null {
  const query = link?.split("?")[1];
  return query ? new URLSearchParams(query).get("loc") : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
