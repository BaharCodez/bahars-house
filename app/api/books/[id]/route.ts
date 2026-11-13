import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { emptyResponse, readJson } from "@/app/lib/routeHelpers";
import { z } from "zod";

const metadataSchema = z.object({
  title: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  coverDataUrl: z.string().startsWith("data:image/").optional(),
});

// Stream the raw EPUB. The shelf is public, so anyone may open a book.
export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/books/[id]">,
) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    select: { data: true },
  });
  if (!book) return emptyResponse(404);

  return new NextResponse(new Uint8Array(book.data), {
    headers: {
      "Content-Type": "application/epub+zip",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// Only the owner can remove a book (cascades to its annotations).
export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/books/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  if (!(await bookExists(id))) return emptyResponse(404);

  await prisma.book.delete({ where: { id } });
  return emptyResponse(204);
}

export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/books/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = metadataSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid book metadata." },
      { status: 400 },
    );
  }

  const { id } = await params;
  if (!(await bookExists(id))) return emptyResponse(404);

  await prisma.book.update({ where: { id }, data: parsed.data });
  return emptyResponse(204);
}

async function bookExists(id: string): Promise<boolean> {
  const book = await prisma.book.findUnique({
    where: { id },
    select: { id: true },
  });
  return book !== null;
}
