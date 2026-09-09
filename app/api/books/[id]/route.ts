import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { z } from "zod";

const metadataSchema = z.object({
  title: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  coverDataUrl: z.string().startsWith("data:image/").optional(),
});

// Stream the raw EPUB. The shelf is public, so anyone may open a book.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    select: { data: true },
  });
  if (!book) return new NextResponse(null, { status: 404 });

  const body = new Uint8Array(book.data);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/epub+zip",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// Only the owner can remove a book (cascades to its annotations).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!book) return new NextResponse(null, { status: 404 });

  await prisma.book.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;
  const parsed = metadataSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid book metadata." },
      { status: 400 },
    );
  }
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!book) return new NextResponse(null, { status: 404 });
  await prisma.book.update({ where: { id }, data: parsed.data });
  return new NextResponse(null, { status: 204 });
}
