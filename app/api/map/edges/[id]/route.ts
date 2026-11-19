import { requireOwner } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import { emptyResponse } from "@/app/lib/routeHelpers";

export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/map/edges/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const deleted = await prisma.mapEdge
    .delete({ where: { id } })
    .catch(() => null);
  if (!deleted) return emptyResponse(404);
  return emptyResponse(204);
}
