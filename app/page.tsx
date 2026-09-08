import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ResponsiveFigmaCanvas from "@/app/components/ResponsiveFigmaCanvas";

export const metadata: Metadata = {
  title: "my portfolio — bahar's house",
  description: "Projects, jobs, and achievements.",
};

const ART = "/figma-home";
type Artwork = { src: string; left: number; top: number; width: number; height: number; alt: string };
const ARTWORK: Artwork[] = [
  { src: "welcome-11.png", left: 1245, top: 1706, width: 273, height: 483, alt: "Botanical collage" },
  { src: "welcome-12.png", left: 29, top: 2309, width: 230, height: 208, alt: "Patterned object" },
  { src: "welcome-14.png", left: 841, top: 389, width: 218, height: 318, alt: "Mushroom collage" },
  { src: "welcome-3.png", left: 1165, top: 368, width: 196, height: 351, alt: "Abstract collage" },
  { src: "welcome-4.png", left: 520, top: 359, width: 229, height: 330, alt: "Green insect collage" },
  { src: "welcome-1.png", left: 44, top: 174, width: 405, height: 545, alt: "Coffee and plant collage" },
  { src: "welcome-1-1.png", left: 1204, top: 29, width: 227, height: 167, alt: "Brain collage" },
  { src: "welcome-2.png", left: 418, top: 17, width: 287, height: 342, alt: "Moon collage" },
  { src: "union.svg", left: 914, top: 909, width: 532, height: 600, alt: "" },
  { src: "welcome-5.png", left: 884, top: 983, width: 499, height: 603, alt: "Flower research collage" },
  { src: "o-is.png", left: 1095, top: 2009, width: 288, height: 360, alt: "Electronic collage" },
  { src: "welcome-15.png", left: 916, top: 1823, width: 290, height: 232, alt: "Plant collage" },
  { src: "welcome-16.png", left: -21, top: 1889, width: 260, height: 315, alt: "Paperclip collage" },
  { src: "welcome-17.png", left: 209, top: 2033, width: 259, height: 366, alt: "Plant collage" },
  { src: "welcome-18.png", left: 1220, top: 2309, width: 249, height: 212, alt: "Book collage" },
];
const ROOMS = [
  {
    href: "/notes",
    label: "The writing room",
    left: 624,
    top: 2751,
    imageLeft: 599,
    imageTop: 2534,
    imageWidth: 236,
    imageHeight: 193,
    imageSrc: "welcome-7.png",
  },
  {
    href: "/study",
    label: "The Study",
    left: 231,
    top: 2866,
    imageLeft: 225,
    imageTop: 2617,
    imageWidth: 254,
    imageHeight: 224,
    imageSrc: "welcome-8.png",
  },
  {
    href: "/workshop",
    label: "The workshop",
    left: 1175,
    top: 3141,
    imageLeft: 1122,
    imageTop: 2778,
    imageWidth: 257,
    imageHeight: 350,
    imageSrc: "a.png",
  },
  {
    href: "/hallway",
    label: "My portfolio",
    left: 711,
    top: 3182,
    imageLeft: 689,
    imageTop: 2907,
    imageWidth: 243,
    imageHeight: 256,
    imageSrc: "welcome-6.png",
  },
  {
    href: "/daily",
    label: "The daily",
    left: 257,
    top: 3188,
    imageLeft: 183,
    imageTop: 2921,
    imageWidth: 266,
    imageHeight: 266,
    imageSrc: "welcome-9.png",
  },
];

function PositionedImage({ artwork }: { artwork: Artwork }) {
  const image = <Image unoptimized src={`${ART}/${artwork.src}?v=2`} alt={artwork.alt} width={artwork.width} height={artwork.height} className={artwork.src === "o-is.png" ? "object-cover transition-transform duration-200 group-hover:scale-105" : "object-cover"} priority={artwork.top < 800} />;
  if (artwork.src !== "o-is.png") {
    return <div className="absolute" style={{ left: artwork.left, top: artwork.top }}>{image}</div>;
  }
  return (
    <div className="group absolute" style={{ left: artwork.left, top: artwork.top }}>
      {image}
      <span                   className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-2 font-mono text-[18px] text-[var(--ink)] shadow-[4px_6px_20px_rgba(42,31,14,0.12)] opacity-0 transition-opacity group-hover:opacity-100">
        I ❤️ caffeine
      </span>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <div className="figma-home overflow-x-hidden bg-[var(--bg)] text-black">
      <ResponsiveFigmaCanvas>
        <section className="relative h-[3334px] w-[1492px]">
          {ARTWORK.map((artwork) => <PositionedImage key={artwork.src} artwork={artwork} />)}
          <h1 className="absolute left-[726px] top-[111px] w-[822px] font-serif text-[84px] font-bold leading-none">
            Welcome<br /><span className="pl-[300px]">to my brain</span>
          </h1>
          <p className="absolute left-[120px] top-[820px] z-10 w-[680px] font-sans text-[34px] leading-normal">
            Hiii I&apos;m Bahar, a Computer Science student at the University
            of Edinburgh who loves to challenge myself and learn. Between a
            part-time job, uni, picking up new skills, and whatever side quest
            I&apos;m on life gets pretty full, so I built this not just to show
            my work but to track my hobbies and grow new habits. I&apos;ll be
            updating it often, so if something looks unpolished or unfinished,
            it&apos;s a learning journey and I hope to continuously improve it.
            Feel free to wander into the rooms, explore, and have a good time!
          </p>
          <section className="absolute left-[406px] top-[1770px] z-10 w-[680px] font-sans text-[34px] leading-normal">
            <h2 className="text-[56px]">My interests...</h2>
            <ul className="mt-6 list-disc pl-[60px]">
              <li className="w-fit transition-transform duration-200 hover:scale-105 focus-within:scale-105">
                Anything science &amp; Tech!
              </li>
              <li className="w-fit transition-transform duration-200 hover:scale-105 focus-within:scale-105">
                CURIOSITY, learning and innovating
              </li>
              <li className="w-fit transition-transform duration-200 hover:scale-105 focus-within:scale-105">
                Coffee, reading and making
              </li>
              <li className="group relative w-fit transition-transform duration-200 hover:scale-105 focus-within:scale-105">
                <span tabIndex={0}>pushing my physical limits</span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 ml-8 -translate-y-1/2 whitespace-nowrap bg-black px-4 py-2 font-mono text-[18px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  I love the gym !!
                </span>
              </li>
              <li className="w-fit transition-transform duration-200 hover:scale-105 focus-within:scale-105">
                plants and solar punk
              </li>
              <li className="w-fit transition-transform duration-200 hover:scale-105 focus-within:scale-105">
                Psychology, EPISTEMOLOGY and neuroscience
              </li>
            </ul>
          </section>
          <div className="absolute left-[932px] top-[2534px] w-[649px]">
            <h2 className="font-serif text-[68px] leading-none">The <strong className="font-bold">rooms...</strong></h2>
            <p className="mt-5 font-serif text-[34px] leading-normal">click on them to visit the room</p>
          </div>
          {ROOMS.map((room) => (
            <div
              key={room.href}
              className="group absolute z-10 h-[700px] w-[800px] transition-transform duration-200 ease-out hover:scale-105 focus-within:scale-105"
              style={{ left: room.imageLeft, top: room.imageTop }}
            >
              <Link
                href={room.href}
                aria-label={`Open ${room.label}`}
                className="absolute z-10 block overflow-visible"
                style={{ left: 0, top: 0, width: room.imageWidth, height: room.imageHeight }}
              >
                <Image
                  unoptimized
                  src={`${ART}/${room.imageSrc}?v=2`}
                  alt=""
                  fill
                  className="object-cover"
                  sizes={`${room.imageWidth}px`}
                />
              </Link>
              <Link
                href={room.href}
                className="absolute z-10 block font-mono text-[30px] leading-normal"
                style={{ left: room.left - room.imageLeft, top: room.top - room.imageTop }}
              >
                {room.label}
              </Link>
            </div>
          ))}
        </section>
      </ResponsiveFigmaCanvas>
    </div>
  );
}
