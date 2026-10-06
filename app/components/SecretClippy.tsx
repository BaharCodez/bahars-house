"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function SecretClippy() {
  const [isDismissed, setIsDismissed] = useState(false);

  return (
    <div
      className={`group absolute ${isDismissed ? "" : "z-50"}`}
      style={{ left: 263, top: 1535 }}
      onMouseLeave={() => setIsDismissed(false)}
    >
      <Image
        unoptimized
        src="/figma-home/welcome-16.png?v=2"
        alt="Clippy"
        width={182}
        height={221}
        className="object-cover transition-transform duration-200 group-hover:scale-105 group-focus-within:scale-105"
      />
      <div
        className={`absolute top-1/2 left-full ml-5 w-[310px] -translate-y-1/2 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-4 font-mono text-[18px] text-[var(--ink)] shadow-[4px_6px_20px_rgba(42,31,14,0.12)] transition-opacity ${isDismissed ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
      >
        <p>Do you want to visit the secret room?</p>
        <div className="mt-3 flex gap-3">
          <Link
            href="/secret"
            className="border border-[var(--line)] px-3 py-1 transition-colors hover:bg-[var(--ink)] hover:text-[var(--surface)]"
          >
            Yes
          </Link>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="border border-[var(--line)] px-3 py-1 transition-colors hover:bg-[var(--ink)] hover:text-[var(--surface)]"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}