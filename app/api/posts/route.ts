import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { postInputSchema } from "@/app/lib/validation";
import { readJson, validationError } from "@/app/lib/routeHelpers";

// Everything is public — drafts too; they're just not "published" yet.
export async function GET() {
  const posts = await prisma.post.findMany({
    orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }],
    select: {
      id: true,
      title: true,
      tags: true,
      coverImage: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = postInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid post.");

  const { published, ...rest } = parsed.data;
  const post = await prisma.post.create({
    data: { ...rest, publishedAt: published ? new Date() : null },
    select: { id: true },
  });
  return NextResponse.json(post, { status: 201 });
}
