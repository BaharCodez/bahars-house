import Link from "next/link";
import { redirect } from "next/navigation";
import { isOwner } from "@/app/lib/session";

/* The hallway: the cottage's welcome landing. Every card is a door into a
   room of the house. Old share links (`/?book=…`) predate the house and are
   forwarded to the study. */

const ROOMS = [
  { href: "/hallway", label: "My Portfolio", emoji: "💼", tagline: "projects, jobs & wins" },
  { href: "/notes", label: "Writing Room", emoji: "✒️", tagline: "notes & essays" },
  { href: "/study", label: "The Study", emoji: "📚", tagline: "what I'm reading" },
  // Roadmaps is a private room — only shown to the owner (see ownerOnly).
  { href: "/roadmaps", label: "Roadmaps", emoji: "🗺️", tagline: "learn it chunk by chunk", ownerOnly: true },
  { href: "/daily", label: "Daily Room", emoji: "☕", tagline: "today, always today" },
  { href: "/workshop", label: "The Workshop", emoji: "🔧", tagline: "things I make" },
];

// Hand-drawn leaf, echoing the sidebar botanicals.
function Leaf({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 120" className={className} aria-hidden="true" fill="none">
      <path
        d="M40 110 C40 110 10 80 8 50 C6 20 40 5 40 5 C40 5 74 20 72 50 C70 80 40 110 40 110Z"
        fill="#5C7D5D"
        opacity="0.5"
      />
      <path d="M40 110 L40 5" stroke="#3D5A3E" strokeWidth="1.5" opacity="0.5" />
      <path d="M40 70 C40 70 22 55 18 40" stroke="#3D5A3E" strokeWidth="1" opacity="0.4" />
      <path d="M40 55 C40 55 55 42 60 30" stroke="#3D5A3E" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

export default async function Hallway({
  searchParams,
}: {
  searchParams: Promise<{ book?: string | string[] }>;
}) {
  const { book } = await searchParams;
  if (typeof book === "string" && book) {
    redirect(`/study?book=${encodeURIComponent(book)}`);
  }

  const owner = await isOwner();
  const rooms = ROOMS.filter((room) => !room.ownerOnly || owner);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* botanical corners */}
      <div className="pointer-events-none absolute top-0 right-0 h-72 w-56 opacity-40">
        <Leaf className="sway absolute top-6 right-10 h-24 w-16" />
        <Leaf className="sway absolute top-20 right-24 h-14 w-10" />
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-44 opacity-30">
        <Leaf className="sway absolute bottom-8 left-6 h-20 w-14 -scale-x-100" />
      </div>

      <div className="fade-up mx-auto max-w-2xl px-8 pt-16 pb-16">
        <span className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
          — the hallway
        </span>
        <h1 className="text-ink mt-3 font-serif text-4xl leading-tight sm:text-5xl">
          Hi, I&apos;m Bahar.
          <br />
          <em>Welcome to my home.</em>
        </h1>
        <p className="text-ink-soft mt-6 max-w-xl text-lg leading-relaxed">
          This is a safe space for me to build, explore, and write.
        </p>
        <p className="text-ink-soft/90 mt-4 max-w-xl leading-relaxed">
          Hiii I&apos;m a Computer Science student at the University of Edinburgh who
          loves to challenge myself and learn. Between a part-time job, uni,
          picking up new skills, and whatever side quest I&apos;m on, life gets
          pretty full, so I built this not just to show my work but to track my
          hobbies and grow new habits.
        </p>
        <p className="text-ink-soft/90 mt-4 max-w-xl leading-relaxed">
          I&apos;ll be updating it often, so if something looks unpolished or
          unfinished, please respect the journey. Otherwise, feel free to wander
          into the rooms, explore, and have a good time!
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rooms.map((room) => (
            <Link
              key={room.href}
              href={room.href}
              className="border-line bg-surface hover:border-accent group rounded-sm border p-5 transition-colors"
            >
              <div className="mb-2 text-2xl">{room.emoji}</div>
              <div className="text-ink font-serif text-base font-medium">
                {room.label}
              </div>
              <div className="text-accent-2 mt-0.5 font-mono text-xs">
                {room.tagline}
              </div>
            </Link>
          ))}
        </div>

        <div className="border-line mt-16 flex items-center gap-3 border-t pt-8">
          <Leaf className="h-8 w-6 opacity-50" />
          <p className="text-ink-soft font-mono text-xs">
            tend the garden · write the words · make the things
          </p>
        </div>
      </div>
    </div>
  );
}
