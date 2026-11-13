import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { dailyTickSchema } from "@/app/lib/validation";
import { readJson, validationError } from "@/app/lib/routeHelpers";

// The streak board is public, like the rest of the house.
export async function GET() {
  const ticks = await prisma.dailyTick.findMany({
    orderBy: { day: "desc" },
    take: 400,
    select: { kind: true, day: true },
  });
  return NextResponse.json(ticks);
}

// Tick off today's habit. Idempotent — ticking twice keeps one row.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = dailyTickSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid tick.");

  const { kind, day } = parsed.data;
  const tick = await prisma.dailyTick.upsert({
    where: { kind_day: { kind, day } },
    update: {},
    create: { kind, day },
  });
  return NextResponse.json(tick, { status: 201 });
}
