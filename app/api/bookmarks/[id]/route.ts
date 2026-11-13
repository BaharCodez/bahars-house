import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { bookmarkPatchSchema } from "@/app/lib/validation";
import { emptyResponse, readJson } from "@/app/lib/routeHelpers";

// Star / unstar a read, or move it to another shelf.
export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/bookmarks/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const parsed = bookmarkPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return emptyResponse(400);

  const bookmark = await prisma.bookmark
    .update({
      where: { id },
      data: parsed.data,
      // Never the cached article body — see the shelf fields in ../route.ts.
      select: { id: true, url: true, title: true, favorite: true, shelf: true },
    })
    .catch(() => null);
  if (!bookmark) return emptyResponse(404);
  return NextResponse.json(bookmark);
}

export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/bookmarks/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const deleted = await prisma.bookmark
    .delete({ where: { id } })
    .catch(() => null);
  if (!deleted) return emptyResponse(404);
  return emptyResponse(204);
}
