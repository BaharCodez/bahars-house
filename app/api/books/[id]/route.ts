import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";

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
