import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { currentUserId } from "@/app/lib/session";
import { annotationInputSchema } from "@/app/lib/validation";
import { emptyResponse, readJson } from "@/app/lib/routeHelpers";
import {
  ANNOTATION_FIELDS,
  toAnnotationJson,
} from "@/app/lib/routeAnnotations";

// Everyone reading a book sees everyone's notes — visitors included; only
// writing them requires an account.
export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/books/[id]/annotations">,
) {
  // currentUserId, not actorUserId: the owner fallback would mark the owner's
  // notes as `mine` for anonymous visitors, showing them delete buttons that
  // can only ever 403.
  const userId = await currentUserId();

  const { id } = await params;
  const annotations = await prisma.annotation.findMany({
    where: { bookId: id },
    orderBy: { createdAt: "asc" },
    select: ANNOTATION_FIELDS,
  });

  return NextResponse.json(
    annotations.map((a) => toAnnotationJson(a, a.userId === userId)),
  );
}

export async function POST(
  req: Request,
  { params }: RouteContext<"/api/books/[id]/annotations">,
) {
  const userId = await currentUserId();
  if (!userId) return emptyResponse(401);

  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!book) return emptyResponse(404);

  const parsed = annotationInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid annotation." }, { status: 400 });
  }

  const created = await prisma.annotation.create({
    data: { ...parsed.data, bookId: id, userId },
    select: ANNOTATION_FIELDS,
  });
  return NextResponse.json(toAnnotationJson(created, true), { status: 201 });
}
