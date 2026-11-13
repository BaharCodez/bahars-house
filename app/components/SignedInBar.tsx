"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import AmbientMusic from "./AmbientMusic";

// `userName` is null for visitors browsing the public shelf.
export default function SignedInBar({ userName }: { userName: string | null }) {
  return (
    <div className="touch-scroll text-ink-soft flex items-center gap-3 overflow-x-auto px-4 py-3 text-sm sm:px-6">
      <Link
        href="/"
        className="font-pixel hover:text-ink shrink-0 transition-colors"
      >
        ← den
      </Link>
      {userName !== null && (
        <span className="shrink-0">
          <span className="hidden sm:inline">Signed in as </span>
          <span className="text-ink font-medium">{userName}</span>
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="text-ink-soft/50 hidden text-[10px] sm:inline">
          build {process.env.NEXT_PUBLIC_BUILD}
        </span>
        <AmbientMusic />
        {userName !== null && (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="hover:text-ink shrink-0"
          >
            Log out
          </button>
        )}
      </div>
    </div>
  );
}
