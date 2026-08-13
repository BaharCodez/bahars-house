import "server-only";
import { DSA_CONTENT } from "./dsaContent";

/**
 * Reading a LeetCode profile from the outside.
 *
 * LeetCode's GraphQL endpoint answers unauthenticated for any public profile,
 * which is the whole reason this works — no key, no scraping, no password.
 * (NeetCode has no equivalent: its progress lives behind your account with no
 * public API, so the account it sends you to is the one we can actually read.)
 *
 * The catch worth knowing: `recentAcSubmissionList` only goes back about 20
 * accepted submissions, so this syncs forward from now rather than
 * backfilling everything you've ever solved.
 */

const ENDPOINT = "https://leetcode.com/graphql";
const TIMEOUT_MS = 10_000;
const RECENT_LIMIT = 20;

export class LeetCodeError extends Error {}

export interface RecentSolve {
  slug: string;
  title: string;
  solvedAt: Date;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function query<T>(
  body: { query: string; variables: Record<string, unknown> },
  what: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // LeetCode turns away requests without a referer.
        Referer: "https://leetcode.com",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new LeetCodeError("Couldn't reach LeetCode just now.");
  }
  if (!res.ok) {
    throw new LeetCodeError(`LeetCode came back ${res.status}.`);
  }

  const json = (await res
    .json()
    .catch(() => null)) as GraphQLResponse<T> | null;
  if (!json || json.errors?.length || !json.data) {
    throw new LeetCodeError(
      json?.errors?.[0]?.message ?? `LeetCode didn't return ${what}.`,
    );
  }
  return json.data;
}

/** Does this profile exist and is it public? Throws if not. */
export async function checkProfile(username: string): Promise<string> {
  // LeetCode answers an unknown handle with a GraphQL error ("That user does
  // not exist."), so the not-found case arrives as a throw rather than a null
  // — catch it and say the more useful thing, since a private profile looks
  // exactly the same from out here.
  const notFound = new LeetCodeError(
    `No public LeetCode profile called "${username}" — check the spelling, and that the profile isn't set to private.`,
  );

  let data: { matchedUser: { username: string } | null };
  try {
    data = await query<{ matchedUser: { username: string } | null }>(
      {
        query: `query u($u: String!) { matchedUser(username: $u) { username } }`,
        variables: { u: username },
      },
      "that profile",
    );
  } catch (e) {
    if (e instanceof LeetCodeError && /does not exist/i.test(e.message)) {
      throw notFound;
    }
    throw e;
  }

  if (!data.matchedUser) throw notFound;
  return data.matchedUser.username;
}

/** The most recent accepted submissions on a public profile. */
export async function recentSolves(username: string): Promise<RecentSolve[]> {
  const data = await query<{
    recentAcSubmissionList:
      | { title: string; titleSlug: string; timestamp: string }[]
      | null;
  }>(
    {
      query: `query r($u: String!, $n: Int!) {
        recentAcSubmissionList(username: $u, limit: $n) {
          title
          titleSlug
          timestamp
        }
      }`,
      variables: { u: username, n: RECENT_LIMIT },
    },
    "your recent submissions",
  );

  return (data.recentAcSubmissionList ?? []).map((s) => ({
    slug: s.titleSlug,
    title: s.title,
    // LeetCode timestamps are seconds.
    solvedAt: new Date(Number(s.timestamp) * 1000),
  }));
}

/** Every problem the DSA board drills, keyed by its LeetCode slug. */
export function problemsBySlug() {
  const map = new Map<string, { url: string; name: string; pattern: string }>();
  for (const [pattern, content] of Object.entries(DSA_CONTENT)) {
    for (const p of content.problems) {
      const slug = p.url.match(/\/problems\/([^/]+)/)?.[1];
      if (slug) map.set(slug, { url: p.url, name: p.name, pattern });
    }
  }
  return map;
}
