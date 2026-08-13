import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { problemLogSchema } from "@/app/lib/validation";

// Log a drilled problem: the verdict (solved / struggled), how hard it felt
// (1 brutal → 5 easy), and your own notes on it. Any part can be sent alone,
// so ticking it off and writing it up are separate moments. Keyed by URL, so
// re-drilling overwrites the last verdict. Owner-only.
//
// LeetCode's own notes can't be synced — they're private to a signed-in
// session with no public endpoint — so these are the house's own.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = problemLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid problem." },
      { status: 400 },
    );
  }
  const { url, name, pattern, status, rating, note } = parsed.data;

  if (status === "clear") {
    await prisma.problemLog.deleteMany({ where: { url } });
    return new NextResponse(null, { status: 204 });
  }

  const existing = await prisma.problemLog.findUnique({ where: { url } });
  if (!existing && status === undefined) {
    return NextResponse.json(
      { error: "Mark it solved or struggled first." },
      { status: 400 },
    );
  }

  const log = await prisma.problemLog.upsert({
    where: { url },
    create: {
      url,
      name,
      pattern,
      status: status ?? "solved",
      rating: rating ?? 0,
      note: note ?? "",
    },
    update: {
      name,
      pattern,
      // Only what was actually sent — writing a note leaves the verdict be.
      ...(status !== undefined && { status }),
      ...(rating !== undefined && { rating }),
      ...(note !== undefined && { note }),
      // Anything touched by hand stops being the sync's.
      ...(status !== undefined && { auto: false }),
    },
  });
  return NextResponse.json(log);
}
