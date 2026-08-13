import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { highlightInputSchema } from "@/app/lib/validation";

// Mark up a passage of an article being read in the house. Owner-only —
// these are Bahar's own "did that land?" marks.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = highlightInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid highlight." },
      { status: 400 },
    );
  }
  const { bookmarkId, start, end, ...rest } = parsed.data;
  if (end <= start) {
    return NextResponse.json(
      { error: "That selection is empty." },
      { status: 400 },
    );
  }

  const bookmark = await prisma.bookmark.findUnique({
    where: { id: bookmarkId },
    select: { id: true },
  });
  if (!bookmark) return new NextResponse(null, { status: 404 });

  const highlight = await prisma.highlight.create({
    data: { bookmarkId, start, end, ...rest },
  });
  return NextResponse.json(highlight, { status: 201 });
}
