"use client";

/* Little animated diagrams that show a DSA pattern's mechanic. Purely
   decorative — returns null for kinds without a visual. */

const CELL = 26; // px per cell incl. gap

function Cells({ n, dim }: { n: number; dim?: "sides" | null }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: n }).map((_, i) => {
        const side =
          dim === "sides" && (i < Math.floor(n / 2) || i > Math.floor(n / 2));
        return (
          <div
            key={i}
            className={`border-line h-5 w-5 rounded-[3px] border bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] ${
              side ? "dsa-anim" : ""
            }`}
            style={side ? { animationName: "dsa-dim" } : undefined}
          />
        );
      })}
    </div>
  );
}

function Node({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <div
      className="dsa-anim border-line absolute flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[9px]"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        animationName: "dsa-glow",
        animationDelay: `${delay}s`,
      }}
    />
  );
}

const NODES = [
  { x: 50, y: 12 },
  { x: 26, y: 50 },
  { x: 74, y: 50 },
  { x: 12, y: 86 },
  { x: 40, y: 86 },
  { x: 60, y: 86 },
  { x: 88, y: 86 },
];
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [2, 6],
];

function Graph({ order }: { order: "bfs" | "dfs" }) {
  // Reveal delays, in the traversal's order.
  const seq =
    order === "bfs"
      ? [0, 0.45, 0.45, 0.9, 0.9, 0.9, 0.9]
      : [0, 0.35, 1.4, 0.7, 1.05, 1.75, 2.1];
  return (
    <div className="relative h-24 w-40">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x}
            y1={NODES[a].y}
            x2={NODES[b].x}
            y2={NODES[b].y}
            stroke="var(--line)"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      {NODES.map((nd, i) => (
        <Node key={i} x={nd.x} y={nd.y} delay={seq[i]} />
      ))}
    </div>
  );
}

export default function PatternViz({ kind }: { kind: string }) {
  switch (kind) {
    case "two-pointers":
      return (
        <div className="relative w-fit pb-5">
          <Cells n={7} />
          <span
            className="dsa-anim text-accent absolute -bottom-0 text-xs font-bold"
            style={{
              left: 4,
              animationName: "dsa-ptr-l",
              ["--conv" as string]: `${3 * CELL}px`,
            }}
          >
            ▲L
          </span>
          <span
            className="dsa-anim text-accent-2 absolute -bottom-0 text-xs font-bold"
            style={{
              right: 4,
              animationName: "dsa-ptr-r",
              ["--conv" as string]: `${3 * CELL}px`,
            }}
          >
            R▲
          </span>
        </div>
      );

    case "sliding-window":
      return (
        <div className="relative w-fit">
          <Cells n={7} />
          <div
            className="dsa-anim border-accent bg-accent/15 absolute top-0 h-5 rounded-[3px] border-2"
            style={{
              width: 3 * CELL - 4,
              animationName: "dsa-window",
              ["--slide" as string]: `${4 * CELL}px`,
            }}
          />
        </div>
      );

    case "binary-search":
      return <Cells n={7} dim="sides" />;

    case "prefix-sum":
      return (
        <div className="flex h-14 items-end gap-1">
          {[3, 5, 8, 11, 14].map((h, i) => (
            <div
              key={i}
              className="dsa-anim bg-accent w-4 origin-bottom rounded-t-[2px]"
              style={{
                height: h * 3,
                animationName: "dsa-grow",
                animationDelay: `${i * 0.25}s`,
                animationIterationCount: "infinite",
                animationDirection: "alternate",
              }}
            />
          ))}
        </div>
      );

    case "fast-slow":
      return (
        <div className="relative w-44">
          <div className="flex items-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center">
                <div className="border-line h-4 w-4 rounded-full border bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]" />
                {i < 5 && <div className="bg-line h-px w-2" />}
              </div>
            ))}
          </div>
          <span
            className="dsa-anim bg-accent absolute -top-1 h-2 w-2 rounded-full"
            style={{ animationName: "dsa-dot", ["--end" as string]: "40%" }}
            title="slow"
          />
          <span
            className="dsa-anim bg-accent-2 absolute -top-1 h-2 w-2 rounded-full"
            style={{ animationName: "dsa-dot", ["--end" as string]: "88%" }}
            title="fast"
          />
        </div>
      );

    case "bfs":
      return <Graph order="bfs" />;
    case "dfs":
      return <Graph order="dfs" />;

    case "dp-grid":
      return (
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 16 }).map((_, i) => {
            const r = Math.floor(i / 4);
            const col = i % 4;
            return (
              <div
                key={i}
                className="dsa-anim border-line h-5 w-5 rounded-[3px] border"
                style={{
                  animationName: "dsa-fill",
                  animationDelay: `${(r + col) * 0.18}s`,
                }}
              />
            );
          })}
        </div>
      );

    default:
      return null;
  }
}
