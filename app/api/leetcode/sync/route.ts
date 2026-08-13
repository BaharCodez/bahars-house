import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import {
  LeetCodeError,
  problemsBySlug,
  recentSolves,
} from "@/app/lib/leetcode";
import {
  LEETCODE_SYNCED_AT,
  LEETCODE_USER,
  getSetting,
  setSetting,
} from "@/app/lib/settings";

// Pull the linked account's recent accepted submissions and tick off any that
// the DSA board drills. Owner-only.
//
// A problem already logged by hand is left alone: if you marked it struggled,
// solving it later doesn't quietly rewrite that. Only untouched problems get
// the automatic ✓.
export async function POST() {
  const denied = await requireOwner();
  if (denied) return denied;

  const username = await getSetting(LEETCODE_USER);
  if (!username) {
    return NextResponse.json(
      { error: "No LeetCode account linked yet." },
      { status: 400 },
    );
  }

  let solves;
  try {
    solves = await recentSolves(username);
  } catch (e) {
    if (e instanceof LeetCodeError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }

  const drilled = problemsBySlug();
  const matched = solves
    .map((s) => ({ solve: s, problem: drilled.get(s.slug) }))
    .filter(
      (
        m,
      ): m is {
        solve: (typeof solves)[0];
        problem: NonNullable<typeof m.problem>;
      } => Boolean(m.problem),
    );

  const already = await prisma.problemLog.findMany({
    where: { url: { in: matched.map((m) => m.problem.url) } },
    select: { url: true },
  });
  const logged = new Set(already.map((p) => p.url));

  const fresh = matched.filter((m) => !logged.has(m.problem.url));
  if (fresh.length) {
    await prisma.problemLog.createMany({
      data: fresh.map((m) => ({
        url: m.problem.url,
        name: m.problem.name,
        pattern: m.problem.pattern,
        status: "solved",
        auto: true,
      })),
      skipDuplicates: true,
    });
  }

  const syncedAt = new Date();
  await setSetting(LEETCODE_SYNCED_AT, syncedAt.toISOString());

  return NextResponse.json({
    username,
    syncedAt: syncedAt.toISOString(),
    // What the board should tick right now, without a reload.
    added: fresh.map((m) => ({
      url: m.problem.url,
      name: m.problem.name,
      pattern: m.problem.pattern,
    })),
    // How many recent solves weren't part of the board at all — context for
    // "I solved loads and nothing moved".
    offBoard: solves.length - matched.length,
  });
}
