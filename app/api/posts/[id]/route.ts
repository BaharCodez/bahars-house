import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { postInputSchema } from "@/app/lib/validation";
import {
  emptyResponse,
  readJson,
  validationError,
} from "@/app/lib/routeHelpers";

export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/posts/[id]">,
) {
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return emptyResponse(404);

  return NextResponse.json(post);
}

export async function PATCH(
  req: Request,
  { params }: RouteContext<"/api/posts/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const parsed = postInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid post.");

  const existing = await prisma.post.findUnique({
    where: { id },
    select: { publishedAt: true },
  });
  if (!existing) return emptyResponse(404);

  const { published, ...rest } = parsed.data;
  const post = await prisma.post.update({
    where: { id },
    data: {
      ...rest,
      // Publishing keeps the original date if it was already public.
      publishedAt: published ? (existing.publishedAt ?? new Date()) : null,
    },
    select: { id: true, publishedAt: true },
  });
  return NextResponse.json(post);
}

export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/posts/[id]">,
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const deleted = await prisma.post.delete({ where: { id } }).catch(() => null);
  if (!deleted) return emptyResponse(404);
  return emptyResponse(204);
}
