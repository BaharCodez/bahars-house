import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { frameInputSchema } from "@/app/lib/validation";
import {
  emptyResponse,
  readJson,
  validationError,
} from "@/app/lib/routeHelpers";

// Rewrite a frame's plaque.
export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/frames/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const parsed = frameInputSchema.partial().safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid frame.");

  const { link, years, ...rest } = parsed.data;
  const frame = await prisma.frame
    .update({
      where: { id },
      data: {
        ...rest,
        ...(years !== undefined && { years: years || null }),
        ...(link !== undefined && { link: link || null }),
      },
    })
    .catch(() => null);
  if (!frame) return emptyResponse(404);

  return NextResponse.json(frame);
}

// Take a frame off the wall.
export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/frames/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const deleted = await prisma.frame
    .delete({ where: { id } })
    .catch(() => null);
  if (!deleted) return emptyResponse(404);

  return emptyResponse(204);
}
