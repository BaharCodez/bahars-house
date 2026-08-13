import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { highlightPatchSchema } from "@/app/lib/validation";

// Change how a passage landed, or what you said about it.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = highlightPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid change." },
      { status: 400 },
    );
  }

  const highlight = await prisma.highlight
    .update({ where: { id }, data: parsed.data })
    .catch(() => null);
  if (!highlight) return new NextResponse(null, { status: 404 });
  return NextResponse.json(highlight);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const deleted = await prisma.highlight
    .delete({ where: { id } })
    .catch(() => null);
  if (!deleted) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
