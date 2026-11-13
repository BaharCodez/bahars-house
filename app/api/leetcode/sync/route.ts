import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import {
  LeetCodeError,
  type RecentSolve,
  problemsBySlug,
  recentSolves,
} from "@/app/lib/leetcode";
import {
  LEETCODE_SYNCED_AT,
  LEETCODE_USER,
  getSetting,
  setSetting,
} from "@/app/lib/settings";

type DrilledProblem = { url: string; name: string; pattern: string };

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

  let solves: RecentSolve[];
  try {
    solves = await recentSolves(username);
  } catch (e) {
    if (e instanceof LeetCodeError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }

  const solvedDrills = drilledProblemsAmong(solves);
  const added = await autoLogUntouched(solvedDrills);

  const syncedAt = new Date().toISOString();
  await setSetting(LEETCODE_SYNCED_AT, syncedAt);

  return NextResponse.json({
    username,
    syncedAt,
    // What the board should tick right now, without a reload.
    added: added.map(({ url, name, pattern }) => ({ url, name, pattern })),
    // How many recent solves weren't part of the board at all — context for
    // "I solved loads and nothing moved".
    offBoard: solves.length - solvedDrills.length,
  });
}

function drilledProblemsAmong(solves: RecentSolve[]): DrilledProblem[] {
  const drilled = problemsBySlug();
  return solves.flatMap((solve) => {
    const problem = drilled.get(solve.slug);
    return problem ? [problem] : [];
  });
}

async function autoLogUntouched(
  problems: DrilledProblem[],
): Promise<DrilledProblem[]> {
  const alreadyLogged = await prisma.problemLog.findMany({
    where: { url: { in: problems.map((p) => p.url) } },
    select: { url: true },
  });
  const loggedUrls = new Set(alreadyLogged.map((p) => p.url));
  const untouched = problems.filter((p) => !loggedUrls.has(p.url));
  if (!untouched.length) return untouched;

  await prisma.problemLog.createMany({
    data: untouched.map((p) => ({
      url: p.url,
      name: p.name,
      pattern: p.pattern,
      status: "solved",
      auto: true,
    })),
    skipDuplicates: true,
  });
  return untouched;
}
