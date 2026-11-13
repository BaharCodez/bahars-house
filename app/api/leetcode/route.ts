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
import {
  emptyResponse,
  readJson,
  validationError,
} from "@/app/lib/routeHelpers";

// Link a LeetCode account to the DSA board. The handle is checked against
// LeetCode before it's saved, so a typo says so now rather than silently
// never syncing. Owner-only.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const parsed = leetcodeUsernameSchema.safeParse(await readJson(req));
  if (!parsed.success)
    return validationError(parsed.error, "Invalid username.");

  try {
    const canonicalUsername = await checkProfile(parsed.data.username);
    await setSetting(LEETCODE_USER, canonicalUsername);
    return NextResponse.json({ username: canonicalUsername });
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
  return emptyResponse(204);
}
