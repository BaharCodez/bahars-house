import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { highlightPatchSchema } from "@/app/lib/validation";
import {
  emptyResponse,
  readJson,
  validationError,
} from "@/app/lib/routeHelpers";

// Change how a passage landed, or what you said about it.
export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/highlights/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const parsed = highlightPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid change.");

  const highlight = await prisma.highlight
    .update({ where: { id }, data: parsed.data })
    .catch(() => null);
  if (!highlight) return emptyResponse(404);
  return NextResponse.json(highlight);
}

export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/highlights/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const deleted = await prisma.highlight
    .delete({ where: { id } })
    .catch(() => null);
  if (!deleted) return emptyResponse(404);
  return emptyResponse(204);
}
