import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { currentUserId } from "@/app/lib/session";
import { emptyResponse, readJson } from "@/app/lib/routeHelpers";

// The signed-in user's reading position in this book (synced across devices).
export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/books/[id]/progress">,
) {
  // currentUserId, not actorUserId: the owner fallback meant an anonymous
  // visitor opening a book resumed from the owner's position, quietly leaking
  // how far she'd read. No session, no saved spot — the book opens at page one.
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ cfi: null });

  const { id } = await params;
  const progress = await prisma.readingProgress.findUnique({
    where: { userId_bookId: { userId, bookId: id } },
    select: { cfi: true },
  });

  return NextResponse.json({ cfi: progress?.cfi ?? null });
}

export async function PUT(
  req: Request,
  { params }: RouteContext<"/api/books/[id]/progress">,
) {
  const userId = await currentUserId();
  if (!userId) return emptyResponse(401);

  const { id } = await params;
  const cfi = cfiFrom(await readJson(req));
  if (!cfi) {
    return NextResponse.json({ error: "Missing cfi." }, { status: 400 });
  }

  await prisma.readingProgress.upsert({
    where: { userId_bookId: { userId, bookId: id } },
    create: { userId, bookId: id, cfi },
    update: { cfi },
  });
  return emptyResponse(204);
}

function cfiFrom(body: unknown): string | null {
  const cfi = (body as { cfi?: unknown } | null)?.cfi;
  return typeof cfi === "string" ? cfi : null;
}
