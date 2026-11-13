import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { bookmarkInputSchema } from "@/app/lib/validation";
import { readJson, validationError } from "@/app/lib/routeHelpers";

// What a shelved read looks like from outside: the card, never the cached
// body. That copy of someone else's article stays behind the owner's door.
const SHELF_FIELDS = {
  id: true,
  url: true,
  title: true,
  source: true,
  favorite: true,
  shelf: true,
  createdAt: true,
} as const;

// The shelf is open to look at — favourites first, then newest.
export async function GET() {
  const bookmarks = await prisma.bookmark.findMany({
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    select: SHELF_FIELDS,
  });
  return NextResponse.json(bookmarks);
}

export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = bookmarkInputSchema.safeParse(await readJson(req));
  if (!parsed.success)
    return validationError(parsed.error, "Invalid bookmark.");

  try {
    const bookmark = await prisma.bookmark.create({
      data: parsed.data,
      select: SHELF_FIELDS,
    });
    return NextResponse.json(bookmark, { status: 201 });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Same URL shelved twice — hand back the one that's already there.
    const existing = await prisma.bookmark.findUnique({
      where: { url: parsed.data.url },
      select: SHELF_FIELDS,
    });
    return NextResponse.json(existing, { status: 200 });
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}
