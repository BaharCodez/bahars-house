import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { highlightInputSchema } from "@/app/lib/validation";
import {
  emptyResponse,
  readJson,
  validationError,
} from "@/app/lib/routeHelpers";

// Mark up a passage of an article being read in the house. Owner-only —
// these are Bahar's own "did that land?" marks.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = highlightInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid highlight.");
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
  if (!bookmark) return emptyResponse(404);

  const highlight = await prisma.highlight.create({
    data: { bookmarkId, start, end, ...rest },
  });
  return NextResponse.json(highlight, { status: 201 });
}
