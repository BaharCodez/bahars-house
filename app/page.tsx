import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import MindMap from "@/app/components/MindMap";
import { MIND_MAP_HEIGHT, MIND_MAP_WIDTH } from "@/app/lib/mindMap";
import ResponsiveFigmaCanvas from "@/app/components/ResponsiveFigmaCanvas";
import SecretClippy from "@/app/components/SecretClippy";

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
    src: "o-is.png",
    left: 1290,
    top: 1620,
    width: 201,
    height: 252,
    alt: "Electronic collage",
  },
  {
    src: "welcome-15.png",
    left: 1180,
    top: 1450,
    width: 203,
    height: 162,
    alt: "Cat benching a barbell",
  },
  {
    src: "welcome-18.png",
    left: 330,
    top: 1850,
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
        artwork.src === "o-is.png" || artwork.src === "welcome-15.png"
          ? "object-cover transition-transform duration-200 group-hover:scale-105"
          : "object-cover"
      }
      priority={artwork.top < 800}
    />
  );
  if (artwork.src !== "o-is.png" && artwork.src !== "welcome-15.png") {
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
        {artwork.src === "welcome-15.png"
          ? "I love the action of me benching 80kg"
          : "I ❤️ caffeine"}
      </span>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <div className="figma-home text-ink overflow-x-hidden">
      <ResponsiveFigmaCanvas>
        <section className="relative h-[2800px] w-[1617px] -translate-x-[80px]">
          {ARTWORK.map((artwork) => (
            <PositionedImage key={artwork.src} artwork={artwork} />
          ))}
          <SecretClippy />
          <div
            className="border-line bg-surface absolute overflow-hidden rounded-2xl border shadow-[4px_6px_20px_rgba(42,31,14,0.12)]"
            style={{
              left: 237,
              top: 30,
              width: MIND_MAP_WIDTH,
              height: MIND_MAP_HEIGHT,
            }}
          >
            <MindMap />
            <h1 className="text-ink pointer-events-none absolute top-[60px] left-[44px] font-serif text-[72px] leading-none font-bold">
              Welcome
              <br />
              <span className="pl-[120px]">to my Brain</span>
            </h1>
          </div>
          <h2 className="absolute top-[792px] left-[277px] font-serif text-[72px] leading-none">
            About me:
          </h2>
          <p className="absolute top-[924px] left-[277px] z-10 w-[1240px] font-sans text-[30px] leading-normal">
            Bahar. Computer science at Edinburgh, a part-time job, and a steady
            supply of side quests. This site is my notebook: the books I&apos;m
            reading, the things I&apos;m writing, the problems I&apos;m solving.
            Nothing here is finished, and that&apos;s the point. A mind
            isn&apos;t a finished thing, it&apos;s one that keeps revising
            itself, and this is mine, in public.
            <span className="mt-6 block">
              The question I keep coming back to is how to optimise my learning
              and my brain. Part of the answer, I think, is humility and mental
              grit: I&apos;m terrible at running, and I keep doing it anyway,
              because being bad at something is how you stay honest. The rest is
              a flat white, a climbing wall and a good book.
            </span>
          </p>
          <section className="absolute top-[1400px] left-[518px] z-10 w-[662px] font-sans text-[30px] leading-normal">
            <h2 className="font-serif text-[56px]">My interests...</h2>
            <ul className="mt-6 list-disc pl-[60px]">
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                Anything science and tech
              </li>
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                Philosophy and thought
              </li>
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                Coffee, reading and making things
              </li>
              <li className="group relative z-50 w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                <button
                  type="button"
                  aria-describedby="gym-tooltip"
                  className="font-inherit cursor-help appearance-none border-0 bg-transparent p-0 text-left text-inherit"
                >
                  Pushing my physical limits
                </button>
                <span
                  id="gym-tooltip"
                  role="tooltip"
                  className="pointer-events-none absolute top-1/2 left-full z-50 ml-8 -translate-y-1/2 rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-2 font-mono text-[18px] whitespace-nowrap text-[var(--ink)] opacity-0 shadow-[4px_6px_20px_rgba(42,31,14,0.12)] transition-opacity select-none group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  I love the gym !!
                </span>
              </li>
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                Plants and solarpunk technology
              </li>
              <li className="w-fit transition-transform duration-200 focus-within:scale-105 hover:scale-105">
                Psychology, epistemology and neuroscience
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
              className="pointer-events-none absolute z-10 h-[700px] w-[800px]"
              style={{ left: room.imageLeft, top: room.imageTop }}
            >
              <Link
                href={room.href}
                aria-label={`Open ${room.label}`}
                className="group pointer-events-auto absolute z-10 block origin-center overflow-visible transition-transform duration-200 ease-out hover:scale-105 focus-visible:scale-105"
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
                <span className="pointer-events-none absolute top-1/2 left-full z-50 ml-4 -translate-y-1/2 rounded-sm border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-[18px] whitespace-nowrap text-[var(--ink)] opacity-0 shadow-[4px_6px_20px_rgba(42,31,14,0.12)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {room.label}
                </span>
              </Link>
              <Link
                href={room.href}
                className="text-ink pointer-events-auto absolute z-10 block origin-left font-mono text-[30px] leading-normal transition-transform duration-200 ease-out hover:scale-105 focus-visible:scale-105"
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
