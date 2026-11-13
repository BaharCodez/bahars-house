import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { emptyResponse, readJson } from "@/app/lib/routeHelpers";

// Toggle a note done/undone (or reword it).
export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/ideas/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const change = ideaChangeFrom(await readJson(req));
  const idea = await prisma.idea
    .update({ where: { id }, data: change })
    .catch(() => null);
  if (!idea) return emptyResponse(404);
  return NextResponse.json(idea);
}

export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/ideas/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const deleted = await prisma.idea.delete({ where: { id } }).catch(() => null);
  if (!deleted) return emptyResponse(404);
  return emptyResponse(204);
}

function ideaChangeFrom(body: unknown): { done?: boolean; text?: string } {
  const { done, text } = (body ?? {}) as { done?: unknown; text?: unknown };
  const change: { done?: boolean; text?: string } = {};
  if (typeof done === "boolean") change.done = done;
  if (typeof text === "string" && text.trim()) {
    change.text = text.trim().slice(0, 500);
  }
  return change;
}
