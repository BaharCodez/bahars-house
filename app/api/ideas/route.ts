import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { ideaInputSchema } from "@/app/lib/validation";
import { readJson, validationError } from "@/app/lib/routeHelpers";

// The hobby board is public to look at; only the owner pins notes.
export async function GET() {
  const ideas = await prisma.idea.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(ideas);
}

export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = ideaInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid idea.");

  const idea = await prisma.idea.create({ data: parsed.data });
  return NextResponse.json(idea, { status: 201 });
}
