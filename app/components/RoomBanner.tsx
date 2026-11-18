/* The cottage room header: a botanical photo with a gradient fade and an
   overlaid typewriter eyebrow + serif heading. Shared by RoomShell and the
   study bookshelf so every room wears the same banner. */
export default function RoomBanner({
  title,
  heading,
  image,
}: {
  title: string;
  heading?: string;
  image: { src: string; alt: string };
}) {
  return (
    <div
      className="border-line relative h-44 overflow-hidden border-b sm:h-56"
      style={{ backgroundColor: "var(--bg-2)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt}
        loading="lazy"
        className="h-full w-full object-cover"
        style={{ filter: "var(--photo-filter)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "var(--photo-wash)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 35%, var(--bg) 100%)",
        }}
      />
      <div className="absolute bottom-5 left-6 sm:left-8">
        <span className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
          {title}
        </span>
        <h1 className="text-ink mt-1 font-serif text-3xl sm:text-4xl">
          {heading ?? title}
        </h1>
      </div>
    </div>
  );
}
