import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { currentUserId } from "@/app/lib/session";
import { annotationPatchSchema } from "@/app/lib/validation";

// Re-categorise a mark, or write its note. Your own notes only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = annotationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid change." },
      { status: 400 },
    );
  }

  const existing = await prisma.annotation.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing) return new NextResponse(null, { status: 404 });
  if (existing.userId !== userId)
    return new NextResponse(null, { status: 403 });

  const updated = await prisma.annotation.update({
    where: { id },
    data: parsed.data,
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

  return NextResponse.json({
    id: updated.id,
    cfiRange: updated.cfiRange,
    text: updated.text,
    comment: updated.comment,
    kind: updated.kind,
    createdAt: updated.createdAt.getTime(),
    authorId: updated.userId,
    authorName: updated.user.name ?? "Anonymous",
    authorImage: updated.user.image,
    mine: true,
  });
}

// You can only delete your own notes.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const annotation = await prisma.annotation.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!annotation) return new NextResponse(null, { status: 404 });
  if (annotation.userId !== userId)
    return new NextResponse(null, { status: 403 });

  await prisma.annotation.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
