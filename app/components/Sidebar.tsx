"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import ThemePicker from "./ThemePicker";
import AmbientMusic from "./AmbientMusic";

type Room = {
  href: string;
  label: string;
  emoji: string;
  // Active when the path starts with `match` (falls back to href).
  match?: string;
  exact?: boolean;
  // Only shown to the site owner (hidden from everyone else's nav).
  ownerOnly?: boolean;
};

const ROOMS: Room[] = [
  { href: "/", label: "The Hallway", emoji: "🏡", exact: true },
  { href: "/hallway", label: "My Portfolio", emoji: "💼" },
  { href: "/notes", label: "Writing Room", emoji: "✒️" },
  { href: "/study", label: "The Study", emoji: "📚" },
  { href: "/roadmaps", label: "Roadmaps", emoji: "🗺️", ownerOnly: true },
  { href: "/daily", label: "Daily Room", emoji: "☕" },
  { href: "/workshop", label: "The Workshop", emoji: "🔧" },
];

// A little fern for the sidebar foot.
function Fern({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 200"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M60 190 C60 190 55 100 60 10"
        stroke="#5C7D5D"
        strokeWidth="2"
        opacity="0.6"
      />
      {[20, 40, 60, 80, 100, 120, 140].map((y, i) => (
        <g key={i}>
          <path
            d={`M60 ${190 - y} C${52 - i} ${190 - y - 16} ${30 + i} ${190 - y - 8} ${22 + i} ${190 - y}`}
            stroke="#5C7D5D"
            strokeWidth="1.2"
            opacity="0.55"
          />
          <path
            d={`M60 ${190 - y} C${68 + i} ${190 - y - 16} ${90 - i} ${190 - y - 8} ${98 - i} ${190 - y}`}
            stroke="#5C7D5D"
            strokeWidth="1.2"
            opacity="0.55"
          />
        </g>
      ))}
    </svg>
  );
}

export default function Sidebar({ isOwner = false }: { isOwner?: boolean }) {
  const pathname = usePathname() ?? "/";
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const signedIn = !!session?.user;
  const rooms = ROOMS.filter((r) => !r.ownerOnly || isOwner);
  const isActive = (r: Room) =>
    r.exact ? pathname === r.href : pathname.startsWith(r.match ?? r.href);

  const nav = (
    <nav className="flex h-full flex-col justify-between px-5 py-8">
      <div>
        <div className="mb-8">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[#8FA888] uppercase">
            welcome to
          </p>
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="font-serif text-xl leading-tight text-[#F4ECD8] hover:text-white"
          >
            bahar&apos;s house
          </Link>
        </div>

        <ul className="space-y-1">
          {rooms.map((room) => {
            const active = isActive(room);
            return (
              <li key={room.href}>
                <Link
                  href={room.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 rounded px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-[#3D5A3E] text-[#F4ECD8]"
                      : "text-[#8FA888] hover:bg-[#3D5A3E]/40 hover:text-[#B8CCAF]"
                  }`}
                >
                  <span className="text-base">{room.emoji}</span>
                  <span>{room.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AmbientMusic />
          <ThemePicker />
        </div>
        <Link
          href={signedIn ? "/study" : "/login"}
          onClick={() => setOpen(false)}
          className="block font-mono text-xs text-[#8FA888] transition-colors hover:text-[#B8CCAF]"
        >
          {signedIn ? "you're in ✓" : "owner's entrance →"}
        </Link>
        <div className="flex items-end justify-between">
          <Fern className="h-16 w-10 opacity-60" />
          <p className="font-mono text-[10px] text-[#5C7D5D]">est. 2026</p>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 px-4 md:hidden"
        style={{
          backgroundColor: "#2A1F0E",
          borderBottom: "1px solid #3D5A3E",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          className="text-[#F4ECD8]"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <Link href="/" className="font-serif text-[#F4ECD8]">
          bahar&apos;s house
        </Link>
      </header>

      {/* Mobile drawer + overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-56 transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#2A1F0E", borderRight: "1px solid #3D5A3E" }}
      >
        {nav}
      </aside>
    </>
  );
}
