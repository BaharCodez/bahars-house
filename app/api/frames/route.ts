import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { frameInputSchema } from "@/app/lib/validation";
import { readJson, validationError } from "@/app/lib/routeHelpers";

// The hallway wall is public — anyone can look at the frames.
export async function GET() {
  const frames = await prisma.frame.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(frames);
}

// Only the owner hangs frames.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = frameInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid frame.");

  const { link, years, ...rest } = parsed.data;
  const frame = await prisma.frame.create({
    data: { ...rest, years: years || null, link: link || null },
  });
  return NextResponse.json(frame, { status: 201 });
}
