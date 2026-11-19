import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { mapNodeInputSchema } from "@/app/lib/validation";
import { readJson, validationError } from "@/app/lib/routeHelpers";
import { toMapNode } from "@/app/lib/mapData";

// Only the owner grows the map. A new node usually hangs off an existing one.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = mapNodeInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid node.");
  const { label, kind, parentId } = parsed.data;

  if (
    parentId &&
    !(await prisma.mapNode.findUnique({ where: { id: parentId } }))
  ) {
    return NextResponse.json({ error: "That node is gone." }, { status: 404 });
  }

  const node = await prisma.mapNode.create({
    data: {
      label,
      kind,
      ...(parentId ? { to: { create: { sourceId: parentId } } } : {}),
    },
  });
  return NextResponse.json(toMapNode(node), { status: 201 });
}
