import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { currentUserId } from "@/app/lib/session";

// The signed-in user's reading position in this book (synced across devices).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
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
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const cfi = typeof body?.cfi === "string" ? body.cfi : null;
  if (!cfi)
    return NextResponse.json({ error: "Missing cfi." }, { status: 400 });

  await prisma.readingProgress.upsert({
    where: { userId_bookId: { userId, bookId: id } },
    create: { userId, bookId: id, cfi },
    update: { cfi },
  });

  return new NextResponse(null, { status: 204 });
}
