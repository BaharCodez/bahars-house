import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { STARTER_EDGES, STARTER_NODES } from "@/app/lib/mindMap";

// Save the starter map into the database so it can be edited. Owner only, and
// only while the map is still empty, so it can never overwrite her edits.
export async function POST() {
  const denied = await requireOwner();
  if (denied) return denied;

  try {
    const created = await prisma.$transaction(async (tx) => {
      if ((await tx.mapNode.count()) > 0) return false;
      await tx.mapNode.createMany({
        data: STARTER_NODES.map((n) => ({
          id: n.id,
          label: n.label,
          kind: n.kind,
          note: n.note,
          links: n.links,
        })),
      });
      await tx.mapEdge.createMany({
        data: STARTER_EDGES.map((e) => ({
          id: e.id,
          sourceId: e.source,
          targetId: e.target,
        })),
      });
      return true;
    });
    if (!created) {
      return NextResponse.json(
        { error: "The map is already saved." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Couldn't save the map. Has the database been updated?" },
      { status: 500 },
    );
  }
}
