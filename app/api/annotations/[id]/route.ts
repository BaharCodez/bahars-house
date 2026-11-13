import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { currentUserId } from "@/app/lib/session";
import { annotationPatchSchema } from "@/app/lib/validation";
import {
  emptyResponse,
  readJson,
  validationError,
} from "@/app/lib/routeHelpers";
import {
  ANNOTATION_FIELDS,
  toAnnotationJson,
} from "@/app/lib/routeAnnotations";

// Re-categorise a mark, or write its note. Your own notes only.
export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/annotations/[id]">,
) {
  const userId = await currentUserId();
  if (!userId) return emptyResponse(401);

  const { id } = await params;
  const parsed = annotationPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid change.");

  const denied = await denyUnlessAuthor(id, userId);
  if (denied) return denied;

  const updated = await prisma.annotation.update({
    where: { id },
    data: parsed.data,
    select: ANNOTATION_FIELDS,
  });
  return NextResponse.json(toAnnotationJson(updated, true));
}

// You can only delete your own notes.
export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/annotations/[id]">,
) {
  const userId = await currentUserId();
  if (!userId) return emptyResponse(401);

  const { id } = await params;
  const denied = await denyUnlessAuthor(id, userId);
  if (denied) return denied;

  await prisma.annotation.delete({ where: { id } });
  return emptyResponse(204);
}

async function denyUnlessAuthor(
  annotationId: string,
  userId: string,
): Promise<NextResponse | null> {
  const annotation = await prisma.annotation.findUnique({
    where: { id: annotationId },
    select: { userId: true },
  });
  if (!annotation) return emptyResponse(404);
  if (annotation.userId !== userId) return emptyResponse(403);
  return null;
}
