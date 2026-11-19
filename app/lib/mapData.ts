import "server-only";
import { prisma } from "@/app/lib/prisma";
import { mapLinkSchema, mapNodePatchSchema } from "@/app/lib/validation";
import {
  STARTER_MAP,
  type MapNode,
  type MapNodeKind,
  type MindMapData,
} from "@/app/lib/mindMap";

// Rows from the database -> the shape the map draws.
type Row = {
  id: string;
  label: string;
  kind: string;
  note: string;
  links: unknown;
  pinnedX: number | null;
  pinnedY: number | null;
};

export function toMapNode(row: Row): MapNode {
  const links = mapLinkSchema.array().safeParse(row.links);
  return {
    id: row.id,
    label: row.label,
    kind: (["core", "topic", "link"].includes(row.kind)
      ? row.kind
      : "topic") as MapNodeKind,
    note: row.note,
    links: links.success ? links.data : [],
    pinned:
      row.pinnedX !== null && row.pinnedY !== null
        ? { x: row.pinnedX, y: row.pinnedY }
        : null,
  };
}

// The map for the landing page. `saved` says whether it came from the
// database; if the tables are empty, missing, or unreachable the starter map
// is shown instead so the page never breaks.
export async function loadMindMap(): Promise<MindMapData & { saved: boolean }> {
  try {
    const [nodes, edges] = await Promise.all([
      prisma.mapNode.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.mapEdge.findMany(),
    ]);
    if (nodes.length === 0) return { ...STARTER_MAP, saved: false };
    return {
      nodes: nodes.map(toMapNode),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
      })),
      saved: true,
    };
  } catch {
    return { ...STARTER_MAP, saved: false };
  }
}

export type NodePatch = ReturnType<typeof mapNodePatchSchema.parse>;
