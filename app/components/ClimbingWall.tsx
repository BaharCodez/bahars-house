"use client";

import { useEffect, useRef } from "react";

// A pixel-art climber on the right edge of the landing page, climbing a
// column of bouldering holds drawn straight onto the page (no wall behind).
// Page scroll drives a camera up a tall column of holds: at the top of the
// page she's at the start, and as you scroll down she climbs; scrolling back
// up, she climbs down. Purely decorative: no pointer events, hidden from
// assistive tech.

type RGB = [number, number, number];

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const hexes = (...hs: string[]) => hs.map(hex);
const tint = (c: RGB, by: number): RGB => [
  Math.min(255, c[0] * by),
  Math.min(255, c[1] * by),
  Math.min(255, c[2] * by),
];

// Width of the column in art pixels (two columns of holds); each art pixel
// is 3–4 CSS pixels depending on screen width.
const COLS = 18;
// How many viewports tall the climb is.
const WORLD_VIEWPORTS = 1.6;
// Where she hangs in the window, as a fraction of its height.
const CLIMBER_AT = 0.58;
// Art rows climbed per pose change.
const STRIDE = 10;

// Stable pseudo-random value in [0, 1) for a grid cell.
function hash(x: number, y: number, seed: number) {
  let h =
    (Math.imul(x, 374761393) +
      Math.imul(y, 668265263) +
      Math.imul(seed, 1442695041)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const pick = <T,>(list: T[], r: number) => list[Math.floor(r * list.length)];

// --- Holds ------------------------------------------------------------------
// Each shape is drawn from the hold's base colour:
//   h highlight, b base, s shade, d deep shadow (the incut you grab),
//   o bolt, space = empty. Every hold gets a soft outline and drop shadow.

const SHAPES: string[][] = [
  // Big jug: deep incut lip along the top.
  [
    "  ddddd  ",
    " dddddds ",
    "hhbbbbbbs",
    "hbbbobbbs",
    "bbbbbbbss",
    " bbbbbss ",
    "  sssss  ",
  ],
  // Jug, tilted.
  [" ddddd  ", "dddddds ", "hbbbbbbs", "hbbobbss", " bbbbss ", "  sss   "],
  // Small jug.
  [" dddd ", "hdddds", "hbobbs", "bbbbss", " sss  "],
  // Pocket: two-finger hole.
  [" hhbb ", "hbddbs", "hbddbs", "bbobss", " sss  "],
  // Crimp rail.
  ["hhhhhhbs", "bbbobbbs", " ssssss "],
];
// Mostly jugs, with the odd pocket or crimp.
const SHAPE_WEIGHTS = [0, 0, 1, 1, 2, 2, 3, 4];

const HOLD_COLORS = hexes(
  "#e86a6a",
  "#5aa9e6",
  "#f2c14e",
  "#7bc67b",
  "#c58be6",
  "#f08a4b",
);
const BOLT = hex("#8d8d98");

function holdColor(ch: string, base: RGB): RGB | null {
  switch (ch) {
    case "h":
      return tint(base, 1.25);
    case "b":
      return base;
    case "s":
      return tint(base, 0.75);
    case "d":
      return tint(base, 0.42);
    case "o":
      return BOLT;
    default:
      return null;
  }
}

// --- The climber, seen from behind ---------------------------------------

const SPRITE_W = 17;
const SPRITE_H = 28;

const C = {
  hair: hex("#1c1a21"),
  hairHi: hex("#3b3745"),
  skin: hex("#e9b995"),
  chalk: hex("#f5efe6"),
  top: hex("#5fb3a8"),
  topShade: hex("#4a978d"),
  pants: hex("#9aa7c2"),
  pantsShade: hex("#7d8aa8"),
  pocket: hex("#6d7896"),
  shoe: hex("#f08a4b"),
  sole: hex("#fdf3e7"),
  handle: hex("#b9875a"),
  bristle: hex("#f3d27a"),
  outline: hex("#2a2430"),
};

type Point = [number, number];
type Pose = { handL: Point; handR: Point; footL: Point; footR: Point };

// One reach-and-pull cycle: left arm high, settle, right arm high, settle.
const POSES: Pose[] = [
  { handL: [2, 2], handR: [14, 10], footL: [4, 26], footR: [11, 22] },
  { handL: [3, 5], handR: [14, 6], footL: [5, 25], footR: [10, 24] },
  { handL: [2, 10], handR: [14, 2], footL: [4, 22], footR: [11, 26] },
  { handL: [3, 6], handR: [13, 5], footL: [6, 24], footR: [11, 25] },
];

// A sprite pixel: colour plus opacity (0 = empty).
type SpritePixel = { c: RGB; a: number } | null;

function makeFrame(pose: Pose): SpritePixel[] {
  const g: SpritePixel[] = new Array(SPRITE_W * SPRITE_H).fill(null);
  const set = (x: number, y: number, c: RGB) => {
    if (x >= 0 && x < SPRITE_W && y >= 0 && y < SPRITE_H) {
      g[y * SPRITE_W + x] = { c, a: 1 };
    }
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
  };
  const line = (from: Point, to: Point, c: RGB, offsets: number[]) => {
    const [x0, y0] = from;
    const dx = to[0] - x0;
    const dy = to[1] - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + (dx * i) / steps);
      const y = Math.round(y0 + (dy * i) / steps);
      for (const o of offsets) set(x + o, y, c);
    }
  };

  const { handL, handR, footL, footR } = pose;

  // Baggy trousers: thick legs, shaded on the outer edge.
  line([6, 17], [footL[0], footL[1] - 2], C.pants, [-1, 0, 1]);
  line([6, 17], [footL[0], footL[1] - 2], C.pantsShade, [-1]);
  line([10, 17], [footR[0], footR[1] - 2], C.pants, [-1, 0, 1]);
  line([10, 17], [footR[0], footR[1] - 2], C.pantsShade, [1]);
  rect(5, 15, 11, 17, C.pants);
  rect(9, 16, 11, 17, C.pocket);

  // Climbing shoes.
  for (const [fx, fy] of [footL, footR]) {
    rect(fx - 1, fy - 1, fx + 1, fy - 1, C.shoe);
    rect(fx - 1, fy, fx + 1, fy, C.sole);
  }

  // Tank top.
  rect(5, 10, 11, 11, C.top);
  rect(6, 12, 10, 14, C.top);
  rect(6, 12, 6, 14, C.topShade);

  // Brush poking out of the back pocket.
  rect(10, 14, 10, 16, C.handle);
  rect(10, 12, 11, 13, C.bristle);

  // Black hair: bun, back of the head and a ponytail.
  rect(7, 1, 9, 2, C.hair);
  rect(6, 3, 10, 9, C.hair);
  rect(5, 4, 11, 8, C.hair);
  rect(8, 9, 8, 13, C.hair);
  set(8, 1, C.hairHi);
  set(7, 4, C.hairHi);
  set(7, 9, C.skin);
  set(9, 9, C.skin);

  // Arms reaching for holds, chalky hands.
  line([6, 10], handL, C.skin, [-1, 0]);
  line([10, 10], handR, C.skin, [0, 1]);
  for (const [hx, hy] of [handL, handR]) rect(hx - 1, hy - 1, hx, hy, C.chalk);

  return withOutline(g, SPRITE_W, SPRITE_H, () => C.outline, 0.55);
}

// Adds a soft 1px outline around every filled pixel of a sprite.
function withOutline(
  g: SpritePixel[],
  w: number,
  h: number,
  color: (neighbour: RGB) => RGB,
  alpha: number,
): SpritePixel[] {
  const out = g.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y * w + x]) continue;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const n = nx >= 0 && nx < w && ny >= 0 && ny < h && g[ny * w + nx];
        if (n) {
          out[y * w + x] = { c: color(n.c), a: alpha };
          break;
        }
      }
    }
  }
  return out;
}

type Sprite = { w: number; h: number; px: SpritePixel[] };

// Every shape in every colour, pre-rendered with outline and drop shadow.
function makeHolds(): Sprite[][] {
  return SHAPES.map((rows) =>
    HOLD_COLORS.map((base) => {
      // One pixel of padding for the outline, plus one for the shadow.
      const w = rows[0].length + 3;
      const h = rows.length + 3;
      const g: SpritePixel[] = new Array(w * h).fill(null);
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const c = holdColor(ch, base);
          if (c) g[(y + 1) * w + x + 1] = { c, a: 1 };
        }),
      );
      const outlined = withOutline(g, w, h, () => tint(base, 0.4), 0.7);
      // Drop shadow down and to the right, under everything else.
      const px = outlined.slice();
      for (let y = 0; y < h - 1; y++) {
        for (let x = 0; x < w - 1; x++) {
          const i = (y + 1) * w + x + 1;
          if (outlined[y * w + x] && !px[i]) {
            px[i] = { c: [42, 31, 14], a: 0.18 };
          }
        }
      }
      return { w, h, px };
    }),
  );
}

export default function ClimbingWall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const frames = POSES.map(makeFrame);
    const holds = makeHolds();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let rows = 0;
    let world = 0;
    let image = ctx.createImageData(COLS, 1);
    let target = 0;
    let current = 0;
    let lastTop = -1;
    let raf = 0;

    const progress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    const draw = () => {
      const top = Math.round((world - rows) * (1 - current));
      if (top === lastTop) return;
      lastTop = top;
      const data = image.data;
      data.fill(0);

      // Composite a pixel over whatever is already there.
      const put = (x: number, r: number, c: RGB, a: number) => {
        if (x < 0 || x >= COLS || r < 0 || r >= rows) return;
        const i = (r * COLS + x) * 4;
        const dstA = data[i + 3] / 255;
        const outA = a + dstA * (1 - a);
        for (let k = 0; k < 3; k++) {
          data[i + k] = (c[k] * a + data[i + k] * dstA * (1 - a)) / outA;
        }
        data[i + 3] = outA * 255;
      };
      const stamp = (s: Sprite, x0: number, y0: number) => {
        for (let sy = 0; sy < s.h; sy++) {
          for (let sx = 0; sx < s.w; sx++) {
            const p = s.px[sy * s.w + sx];
            if (p) put(x0 + sx, y0 + sy, p.c, p.a);
          }
        }
      };

      // Holds on a loose grid: two staggered columns.
      const CELL_W = 9;
      const CELL_H = 12;
      for (
        let cy = Math.floor(top / CELL_H) - 1;
        cy <= Math.floor((top + rows) / CELL_H);
        cy++
      ) {
        for (let cx = 0; cx < COLS / CELL_W; cx++) {
          if (hash(cx, cy, 11) > 0.72) continue;
          const shape = pick(SHAPE_WEIGHTS, hash(cx, cy, 15));
          const color = Math.floor(hash(cx, cy, 14) * HOLD_COLORS.length);
          const sprite = holds[shape][color];
          const x =
            cx * CELL_W +
            Math.floor(hash(cx, cy, 12) * (CELL_W - sprite.w + 4)) -
            1;
          const y =
            cy * CELL_H + (cx % 2) * 6 + Math.floor(hash(cx, cy, 13) * 3);
          stamp(sprite, x, y - top);
        }
      }

      // The climber; her pose advances with every few rows climbed.
      const climbed = world - rows - top;
      const frame = reduceMotion.matches
        ? frames[1]
        : frames[Math.floor(climbed / STRIDE) % frames.length];
      stamp(
        { w: SPRITE_W, h: SPRITE_H, px: frame },
        Math.floor((COLS - SPRITE_W) / 2),
        Math.round(rows * CLIMBER_AT - SPRITE_H / 2),
      );

      ctx.putImageData(image, 0, 0);
    };

    const resize = () => {
      const scale = window.innerWidth >= 1280 ? 4 : 3;
      rows = Math.ceil(window.innerHeight / scale);
      world = Math.round(rows * WORLD_VIEWPORTS);
      canvas.width = COLS;
      canvas.height = rows;
      canvas.style.width = `${COLS * scale}px`;
      canvas.style.height = `${rows * scale}px`;
      image = ctx.createImageData(COLS, rows);
      lastTop = -1;
      draw();
    };

    // Ease towards the scroll position so she climbs smoothly.
    const tick = () => {
      raf = 0;
      const diff = target - current;
      current =
        reduceMotion.matches || Math.abs(diff) < 0.0005
          ? target
          : current + diff * 0.07;
      draw();
      if (current !== target) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      target = progress();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    target = current = progress();
    resize();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    // The page grows as images load, which shifts scroll progress.
    const observer = new ResizeObserver(onScroll);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Pinned to the right edge, where the landing page leaves empty space at
  // every screen size.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 right-0 z-30 [image-rendering:pixelated]"
    />
  );
}
