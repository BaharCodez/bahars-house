import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { roadmapStepPatchSchema } from "@/app/lib/validation";

// Tick a roadmap step done / undone, or rate how solid it feels.
// Owner-only — it's Bahar's progress.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = roadmapStepPatchSchema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const step = await prisma.roadmapStep
    .update({ where: { id }, data: parsed.data })
    .catch(() => null);
  if (!step) return new NextResponse(null, { status: 404 });
  return NextResponse.json({
    id: step.id,
    done: step.done,
    confidence: step.confidence,
  });
}
