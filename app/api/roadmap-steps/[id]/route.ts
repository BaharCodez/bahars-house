import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { roadmapStepPatchSchema } from "@/app/lib/validation";
import { emptyResponse, readJson } from "@/app/lib/routeHelpers";

// Tick a roadmap step done / undone, or rate how solid it feels.
// Owner-only — it's Bahar's progress.
export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/roadmap-steps/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const parsed = roadmapStepPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return emptyResponse(400);

  const step = await prisma.roadmapStep
    .update({
      where: { id },
      data: parsed.data,
      select: { id: true, done: true, confidence: true },
    })
    .catch(() => null);
  if (!step) return emptyResponse(404);
  return NextResponse.json(step);
}
