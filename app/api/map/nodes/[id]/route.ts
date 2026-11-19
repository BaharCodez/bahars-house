import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { mapNodePatchSchema } from "@/app/lib/validation";
import {
  emptyResponse,
  readJson,
  validationError,
} from "@/app/lib/routeHelpers";
import { toMapNode } from "@/app/lib/mapData";

export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/map/nodes/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = mapNodePatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid change.");
  const { pinned, ...rest } = parsed.data;

  const { id } = await params;
  const node = await prisma.mapNode
    .update({
      where: { id },
      data: {
        ...rest,
        ...(pinned === undefined
          ? {}
          : { pinnedX: pinned?.x ?? null, pinnedY: pinned?.y ?? null }),
      },
    })
    .catch(() => null);
  if (!node) return emptyResponse(404);
  return NextResponse.json(toMapNode(node));
}

export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/map/nodes/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const node = await prisma.mapNode.findUnique({ where: { id } });
  if (!node) return emptyResponse(404);
  // The centre of the map stays: everything hangs off it.
  if (node.kind === "core") {
    return NextResponse.json(
      { error: "The centre of the map can't be deleted." },
      { status: 400 },
    );
  }
  await prisma.mapNode.delete({ where: { id } }); // edges cascade
  return emptyResponse(204);
}
