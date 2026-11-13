import { createHash } from "crypto";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { isOwner } from "@/app/lib/session";
import { emptyResponse, readJson } from "@/app/lib/routeHelpers";

type UserAgentPattern = [pattern: RegExp, label: string];

// Checked in order: iPads and Android phones also claim Mac / Linux, and
// Edge and Opera also claim Chrome and Safari.
const OS_PATTERNS: UserAgentPattern[] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X/, "Mac"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];
const BROWSER_PATTERNS: UserAgentPattern[] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
];

export async function POST(req: Request) {
  // Never log the owner's own visits — this is for seeing *other* people.
  if (await isOwner()) return emptyResponse(204);

  const body = (await readJson(req)) as {
    path?: unknown;
    ref?: unknown;
  } | null;
  const path = typeof body?.path === "string" ? body.path.slice(0, 200) : "/";
  const referrer = typeof body?.ref === "string" ? refHost(body.ref) : "";

  const headers = req.headers;
  await prisma.visit.create({
    data: {
      path,
      country: headers.get("x-vercel-ip-country") ?? "",
      city: decodeURIComponent(headers.get("x-vercel-ip-city") ?? ""),
      region: headers.get("x-vercel-ip-country-region") ?? "",
      referrer,
      device: parseDevice(headers.get("user-agent") ?? ""),
      ipHash: hashClientIp(headers),
      visitorName: await signedInVisitorName(),
    },
  });
  return emptyResponse(204);
}

// The referrer's host, or "" for direct / same-site.
function refHost(ref: string): string {
  try {
    return ref ? new URL(ref).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

// Rough device/browser from the user-agent — no external dependency.
function parseDevice(userAgent: string): string {
  const os = firstLabel(userAgent, OS_PATTERNS);
  const browser = firstLabel(userAgent, BROWSER_PATTERNS);
  return [os, browser].filter(Boolean).join(" · ") || "unknown";
}

function firstLabel(userAgent: string, patterns: UserAgentPattern[]): string {
  return patterns.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "";
}

// Salted and truncated so repeat visits can be told apart without the raw IP
// ever being stored.
function hashClientIp(headers: Headers): string {
  const ip = (headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  if (!ip) return "";
  return createHash("sha256")
    .update(ip + (process.env.AUTH_SECRET ?? "salt"))
    .digest("hex")
    .slice(0, 16);
}

// A name only if the visitor happens to be signed in (rare).
async function signedInVisitorName(): Promise<string> {
  const session = await auth();
  if (!session?.user) return "";
  return session.user.name ?? session.user.email ?? "";
}
