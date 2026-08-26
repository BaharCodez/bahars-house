import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { actorUserId, currentUserId, requireOwner } from "@/app/lib/session";
import { annotationInputSchema } from "@/app/lib/validation";

// Everyone reading a book sees everyone's notes — visitors included; only
// writing them requires an account.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // currentUserId, not actorUserId: the owner fallback would mark the owner's
  // notes as `mine` for anonymous visitors, showing them delete buttons that
  // can only ever 403.
  const userId = await currentUserId();

  const { id } = await params;
  const annotations = await prisma.annotation.findMany({
    where: { bookId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      cfiRange: true,
      text: true,
      comment: true,
      kind: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, image: true } },
    },
  });

  return NextResponse.json(
    annotations.map((a) => ({
      id: a.id,
      cfiRange: a.cfiRange,
      text: a.text,
      comment: a.comment,
      kind: a.kind,
      createdAt: a.createdAt.getTime(),
      authorId: a.userId,
      authorName: a.user.name ?? "Anonymous",
      authorImage: a.user.image,
      mine: a.userId === userId,
    })),
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;
  const userId = await actorUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!book) return new NextResponse(null, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = annotationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid annotation." }, { status: 400 });
  }

  const created = await prisma.annotation.create({
    data: { ...parsed.data, bookId: id, userId },
    select: {
      id: true,
      cfiRange: true,
      text: true,
      comment: true,
      kind: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, image: true } },
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      cfiRange: created.cfiRange,
      text: created.text,
      comment: created.comment,
      kind: created.kind,
      createdAt: created.createdAt.getTime(),
      authorId: created.userId,
      authorName: created.user.name ?? "Anonymous",
      authorImage: created.user.image,
      mine: true,
    },
    { status: 201 },
  );
}
