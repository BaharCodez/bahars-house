import { NextResponse } from "next/server";
import { requireOwner } from "@/app/lib/session";
import { leetcodeUsernameSchema } from "@/app/lib/validation";
import { LeetCodeError, checkProfile } from "@/app/lib/leetcode";
import {
  LEETCODE_SYNCED_AT,
  LEETCODE_USER,
  clearSetting,
  setSetting,
} from "@/app/lib/settings";

// Link a LeetCode account to the DSA board. The handle is checked against
// LeetCode before it's saved, so a typo says so now rather than silently
// never syncing. Owner-only.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = leetcodeUsernameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid username." },
      { status: 400 },
    );
  }

  try {
    // Save the spelling LeetCode itself uses.
    const username = await checkProfile(parsed.data.username);
    await setSetting(LEETCODE_USER, username);
    return NextResponse.json({ username });
  } catch (e) {
    if (e instanceof LeetCodeError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}

// Unlink. The problems already ticked stay ticked — they were still solved.
export async function DELETE() {
  const denied = await requireOwner();
  if (denied) return denied;

  await clearSetting(LEETCODE_USER);
  await clearSetting(LEETCODE_SYNCED_AT);
  return new NextResponse(null, { status: 204 });
}
