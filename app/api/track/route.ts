import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { isOwner } from "@/app/lib/session";

// Rough device/browser from the user-agent — no external dependency.
function parseDevice(ua: string): string {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  return [os, browser].filter(Boolean).join(" · ") || "unknown";
}

// The referrer's host, or "" for direct / same-site.
function refHost(ref: string): string {
  try {
    return ref ? new URL(ref).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  // Never log the owner's own visits — this is for seeing *other* people.
  if (await isOwner()) return new NextResponse(null, { status: 204 });

  const body = await req.json().catch(() => ({}));
  const path = typeof body?.path === "string" ? body.path.slice(0, 200) : "/";
  const referrer = typeof body?.ref === "string" ? refHost(body.ref) : "";

  const h = req.headers;
  const country = h.get("x-vercel-ip-country") ?? "";
  const city = decodeURIComponent(h.get("x-vercel-ip-city") ?? "");
  const region = h.get("x-vercel-ip-country-region") ?? "";
  const device = parseDevice(h.get("user-agent") ?? "");

  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  const ipHash = ip
    ? createHash("sha256")
        .update(ip + (process.env.AUTH_SECRET ?? "salt"))
        .digest("hex")
        .slice(0, 16)
    : "";

  // A name only if the visitor happens to be signed in (rare).
  const session = await auth();
  const visitorName = session?.user
    ? (session.user.name ?? session.user.email ?? "")
    : "";

  await prisma.visit.create({
    data: {
      path,
      country,
      city,
      region,
      referrer,
      device,
      ipHash,
      visitorName,
    },
  });
  return new NextResponse(null, { status: 204 });
}
