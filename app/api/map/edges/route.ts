import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { mapEdgeInputSchema } from "@/app/lib/validation";
import { readJson, validationError } from "@/app/lib/routeHelpers";

// Connect two nodes. Connections are undirected, so A→B and B→A are the same.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = mapEdgeInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid link.");
  const { sourceId, targetId } = parsed.data;

  const existing = await prisma.mapEdge.findFirst({
    where: {
      OR: [
        { sourceId, targetId },
        { sourceId: targetId, targetId: sourceId },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ id: existing.id, sourceId, targetId });
  }

  const edge = await prisma.mapEdge
    .create({ data: { sourceId, targetId } })
    .catch(() => null);
  if (!edge) {
    return NextResponse.json(
      { error: "Both nodes must exist." },
      { status: 404 },
    );
  }
  return NextResponse.json(edge, { status: 201 });
}
