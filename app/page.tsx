import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ResponsiveFigmaCanvas from "@/app/components/ResponsiveFigmaCanvas";

export const metadata: Metadata = {
  title: "my portfolio — bahar's house",
  description: "Projects, jobs, and achievements.",
};

const ART = "/figma-home";
type Artwork = {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  alt: string;
};
const ARTWORK: Artwork[] = [
  {
    src: "welcome-11.png",
    left: 1154,
    top: 1410,
    width: 177,
    height: 314,
    alt: "Botanical collage",
  },
  {
    src: "welcome-12.png",
    left: 297,
    top: 1831,
    width: 161,
    height: 145,
    alt: "Patterned object",
  },
  {
    src: "welcome-14.png",
    left: 900,
    top: 455,
    width: 156,
    height: 228,
    alt: "Mushroom collage",
  },
  {
    src: "welcome-3.png",
    left: 1126,
    top: 440,
    width: 140,
    height: 250,
    alt: "Abstract collage",
  },
  {
    src: "welcome-4.png",
    left: 630,
    top: 300,
    width: 163,
    height: 235,
    alt: "Green insect collage",
  },
  {
    src: "welcome-1.png",
    left: 277,
    top: 199,
    width: 289,
    height: 389,
    alt: "Coffee and plant collage",
  },
  {
    src: "welcome-1-1.png",
    left: 1114,
    top: 78,
    width: 164,
    height: 121,
    alt: "Brain collage",
  },
  {
    src: "welcome-2.png",
    left: 564,
    top: 10,
    width: 206,
    height: 245,
    alt: "Moon collage",
  },
  { src: "union.svg", left: 994, top: 874, width: 386, height: 441, alt: "" },
  {
    src: "welcome-5.png",
    left: 967,
    top: 927,
    width: 365,
    height: 440,
    alt: "Flower research collage",
  },
  {
    src: "o-is.png",
    left: 1044,
    top: 1603,
    width: 201,
    height: 252,
    alt: "Electronic collage",
  },
  {
    src: "welcome-15.png",
    left: 981,
    top: 1447,
    width: 203,
    height: 162,
    alt: "Plant collage",
  },
  {
    src: "welcome-16.png",
    left: 263,
    top: 1535,
    width: 182,
    height: 221,
    alt: "Paperclip collage",
  },
  {
    src: "welcome-17.png",
    left: 925,
    top: 430,
    width: 182,
    height: 257,
    alt: "Plant collage",
  },
  {
    src: "welcome-18.png",
    left: 1148,
    top: 1829,
    width: 174,
    height: 148,
    alt: "Book collage",
  },
];
const ROOMS = [
  {
    href: "/notes",
    label: "The writing room",
    left: 628,
    top: 2364,
    imageLeft: 622,
    imageTop: 2188,
    imageWidth: 186,
    imageHeight: 152,
    imageSrc: "welcome-7.png",
  },
  {
    href: "/study",
    label: "The Study",
    left: 334,
    top: 2386,
    imageLeft: 328,
    imageTop: 2188,
    imageWidth: 199,
    imageHeight: 176,
    imageSrc: "welcome-8.png",
  },
  {
    href: "/workshop",
    label: "The workshop",
    left: 1175,
    top: 2599,
    imageLeft: 1120,
    imageTop: 2318,
    imageWidth: 202,
    imageHeight: 275,
    imageSrc: "a.png",
  },
  {
    href: "/hallway",
    label: "My portfolio",
    left: 808,
    top: 2654,
    imageLeft: 778,
    imageTop: 2453,
    imageWidth: 190,
    imageHeight: 201,
    imageSrc: "welcome-6.png",
  },
  {
    href: "/daily",
    label: "The daily",
    left: 452,
    top: 2667,
    imageLeft: 416,
    imageTop: 2450,
    imageWidth: 209,
    imageHeight: 209,
    imageSrc: "welcome-9.png",
  },
];

function PositionedImage({ artwork }: { artwork: Artwork }) {
  const image = (
    <Image
      unoptimized
      src={`${ART}/${artwork.src}?v=2`}
      alt={artwork.alt}
      width={artwork.width}
      height={artwork.height}
      className={
        artwork.src === "o-is.png"
          ? "object-cover transition-transform duration-200 group-hover:scale-105"
          : "object-cover"
      }
      priority={artwork.top < 800}
    />
  );
  if (artwork.src !== "o-is.png") {
    return (
      <div
        className="absolute"
        style={{ left: artwork.left, top: artwork.top }}
      >
        {image}
      </div>
    );
  }
  return (
    <div
      className="group absolute"
      style={{ left: artwork.left, top: artwork.top }}
    >
      {image}
      <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-2 font-mono text-[18px] whitespace-nowrap text-[var(--ink)] opacity-0 shadow-[4px_6px_20px_rgba(42,31,14,0.12)] transition-opacity group-hover:opacity-100">
        I ❤️ caffeine
      </span>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <div className="figma-home text-ink overflow-x-hidden">
      <ResponsiveFigmaCanvas>
        <section className="relative h-[3155px] w-[1617px]">
          {ARTWORK.map((artwork) => (
            <PositionedImage key={artwork.src} artwork={artwork} />
          ))}
          <h1 className="absolute top-[199px] left-[808px] w-[572px] font-serif text-[84px] leading-none font-bold">
            Welcome
            <br />
            <span className="pl-[300px]">to my brain</span>
          </h1>
          <h2 className="absolute top-[792px] left-[277px] font-serif text-[72px] leading-none">
            About me:
          </h2>
          <p className="absolute top-[924px] left-[277px] z-10 w-[610px] font-sans text-[30px] leading-normal">
            Hiii I&apos;m Bahar, a Computer Science student at the University of
            Edinburgh who loves to challenge myself and learn. Between a
            part-time job, uni, picking up new skills, and whatever side quest
            I&apos;m on life gets pretty full, so I built this not just to show
            my work but to track my hobbies and grow new habits. I&apos;ll be
            updating it often, so if something looks unpolished or unfinished,
            it&apos;s a learning journey and I hope to continuously improve it.
            Feel free to wander into the rooms, explore, and have a good time!
          </p>
          <section className="absolute top-[1548px] left-[518px] z-10 w-[662px] font-sans text-[30px] leading-normal">
            <h2 className="font-serif text-[56px]">My interests...</h2>
            <ul className="mt-6 list-disc pl-[60px]">
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                Anything science &amp; Tech!
              </li>
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                CURIOSITY, learning and innovating
              </li>
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                Coffee, reading and making
              </li>
              <li className="group relative w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                <span tabIndex={0}>pushing my physical limits</span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-1/2 left-full ml-8 -translate-y-1/2 rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-2 font-mono text-[18px] whitespace-nowrap text-[var(--ink)] opacity-0 shadow-[4px_6px_20px_rgba(42,31,14,0.12)] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  I love the gym !!
                </span>
              </li>
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                plants and solar punk
              </li>
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                Psychology, EPISTEMOLOGY and neuroscience
              </li>
            </ul>
          </section>
          <div className="absolute top-[2099px] left-[860px] w-[550px]">
            <h2 className="font-serif text-[68px] leading-none">
              The <strong className="font-bold">rooms...</strong>
            </h2>
            <p className="mt-5 ml-[93px] font-serif text-[30px] leading-normal">
              click on them to visit the room
            </p>
          </div>
          {ROOMS.map((room) => (
            <div
              key={room.href}
              className="group absolute z-10 h-[700px] w-[800px] transition-transform duration-200 ease-out focus-within:scale-105 hover:scale-105"
              style={{ left: room.imageLeft, top: room.imageTop }}
            >
              <Link
                href={room.href}
                aria-label={`Open ${room.label}`}
                className="absolute z-10 block overflow-visible"
                style={{
                  left: 0,
                  top: 0,
                  width: room.imageWidth,
                  height: room.imageHeight,
                }}
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
                className="text-accent-2 absolute z-10 block font-mono text-[30px] leading-normal"
                style={{
                  left: room.left - room.imageLeft,
                  top: room.top - room.imageTop,
                }}
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
