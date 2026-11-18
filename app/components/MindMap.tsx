"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import {
  MAP_EDGES,
  MAP_NODES,
  MIND_MAP_HEIGHT,
  MIND_MAP_WIDTH,
  type MapNode,
} from "@/app/lib/mindMap";

// A neural-network mind map. The topics are neurons with wiggling dendrites;
// small unlabeled neurons fill out a brain-shaped cloud around them, and
// signals fire along the connections. Read-only: visitors can drag neurons
// around (they spring back) and click the link nodes, nothing is saved.

const FILLERS = 46;
const BRAIN_CENTRE = { x: MIND_MAP_WIDTH * 0.56, y: MIND_MAP_HEIGHT * 0.54 };
const BRAIN_RADIUS = { x: MIND_MAP_WIDTH * 0.37, y: MIND_MAP_HEIGHT * 0.375 };

type Dendrite = { angle: number; length: number; phase: number };
type Neuron = SimulationNodeDatum & {
  /** Present on mapped topics; fillers are decoration. */
  node?: MapNode;
  radius: number;
  dendrites: Dendrite[];
};
type Axon = SimulationLinkDatum<Neuron> & { hub: boolean; bend: number };
type Pulse = { axon: Axon; t: number; speed: number; reverse: boolean };

// Stable pseudo-random in [0, 1) so the layout is the same every load.
const rand = (i: number) => {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

// Colours come from the site's theme tokens, so the map always matches the
// page (cream, moss and rust today) and follows any future retheme.
function readPalette(el: HTMLElement) {
  const style = getComputedStyle(el);
  const hex = (name: string, fallback: string) => {
    const v = style.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  };
  const rgb = (h: string) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");
  const moss = hex("--accent", "#3f5a3c");
  const rust = hex("--accent-2", "#8a4a2a");
  const gold = hex("--shelf", "#c69e66");
  const signal = hex("--signal", hex("--shelf-edge", "#9a7342"));
  const ink = hex("--ink", "#221f19");
  return {
    core: rust,
    coreGlow: rgb(rust),
    topic: moss,
    axon: rgb(moss),
    link: gold,
    signal: rgb(signal),
    hover: ink,
    hoverGlow: rgb(ink),
    label: ink,
    ink: rgb(ink),
  };
}

function build() {
  const neurons: Neuron[] = MAP_NODES.map((node, i) => ({
    node,
    radius: node.kind === "core" ? 17 : node.kind === "link" ? 6 : 11,
    dendrites: Array.from({ length: 9 }, (_, k) => ({
      angle: rand(i * 17 + k) * Math.PI * 2,
      length: 1.5 + rand(i * 5 + k) * 1.3,
      phase: rand(i + k) * Math.PI * 2,
    })),
  }));
  const topicCount = neurons.length;
  for (let i = 0; i < FILLERS; i++) {
    neurons.push({
      radius: 2 + rand(i) * 2,
      dendrites: [],
      x: BRAIN_CENTRE.x + (rand(i * 3) - 0.5) * 600,
      y: BRAIN_CENTRE.y + (rand(i * 7) - 0.5) * 400,
    });
  }

  const index = new Map(MAP_NODES.map((n, i) => [n.id, i]));
  const axons: Axon[] = MAP_EDGES.map((e, i) => ({
    source: index.get(e.source)!,
    target: index.get(e.target)!,
    hub: true,
    bend: (rand(i * 9 + 3) - 0.5) * 0.5,
  }));
  // Each filler wires itself to two of the topic neurons, never the link tags.
  const wireable = MAP_NODES.filter((n) => n.kind !== "link").length;
  for (let i = 0; i < FILLERS; i++) {
    const a = Math.floor(rand(i * 11) * wireable);
    const b = (a + 1 + Math.floor(rand(i * 13) * (wireable - 1))) % wireable;
    for (const [k, target] of [a, b].entries()) {
      axons.push({
        source: topicCount + i,
        target,
        hub: false,
        bend: (rand(i + k * 50) - 0.5) * 0.6,
      });
    }
  }
  return { neurons, axons };
}

export default function MindMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dpr = Math.min(2, window.devicePixelRatio || 1) * 1.5;
    canvas.width = MIND_MAP_WIDTH * dpr;
    canvas.height = MIND_MAP_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const family =
      getComputedStyle(canvas).getPropertyValue("--font-space-mono").trim() ||
      "'Courier New'";

    const COLORS = readPalette(canvas);
    const { neurons, axons } = build();
    const mapped = neurons.filter((n) => n.node);

    const simulation = forceSimulation(neurons)
      .force(
        "link",
        forceLink<Neuron, Axon>(axons)
          .distance((a) =>
            a.hub
              ? (a.target as Neuron).node?.kind === "link"
                ? 95
                : 140
              : 70,
          )
          .strength((a) => (a.hub ? 0.8 : 0.12)),
      )
      .force(
        "charge",
        forceManyBody<Neuron>().strength((n) => (n.node ? -380 : -28)),
      )
      .force(
        "collide",
        forceCollide<Neuron>((n) => n.radius + 10),
      )
      .force("x", forceX<Neuron>(BRAIN_CENTRE.x).strength(0.02))
      .force("y", forceY<Neuron>(BRAIN_CENTRE.y).strength(0.025))
      // Keep the whole cloud inside a brain-sized oval.
      .force("brain", () => {
        for (const n of neurons) {
          const dx = ((n.x ?? 0) - BRAIN_CENTRE.x) / BRAIN_RADIUS.x;
          const dy = ((n.y ?? 0) - BRAIN_CENTRE.y) / BRAIN_RADIUS.y;
          const q = dx * dx + dy * dy;
          if (q > 1) {
            const k = (1 - 1 / Math.sqrt(q)) * 0.12;
            n.vx = (n.vx ?? 0) - ((n.x ?? 0) - BRAIN_CENTRE.x) * k;
            n.vy = (n.vy ?? 0) - ((n.y ?? 0) - BRAIN_CENTRE.y) * k;
          }
        }
      });
    if (reduceMotion.matches) {
      // Settle once, then stay still.
      simulation.stop();
      simulation.tick(300);
    }

    const ends = (a: Axon) => {
      const s = a.source as Neuron;
      const t = a.target as Neuron;
      return { sx: s.x ?? 0, sy: s.y ?? 0, tx: t.x ?? 0, ty: t.y ?? 0 };
    };
    const control = (a: Axon) => {
      const { sx, sy, tx, ty } = ends(a);
      return {
        x: (sx + tx) / 2 - (ty - sy) * a.bend,
        y: (sy + ty) / 2 + (tx - sx) * a.bend,
      };
    };
    const pointOn = (a: Axon, t: number) => {
      const { sx, sy, tx, ty } = ends(a);
      const c = control(a);
      const u = 1 - t;
      return {
        x: u * u * sx + 2 * u * t * c.x + t * t * tx,
        y: u * u * sy + 2 * u * t * c.y + t * t * ty,
      };
    };

    let hover: Neuron | null = null;
    let pulses: Pulse[] = [];
    let lastPulse = 0;
    let raf = 0;
    let visible = true;

    const lit = (a: Axon) =>
      hover !== null && (a.source === hover || a.target === hover);

    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const W = MIND_MAP_WIDTH;
      const H = MIND_MAP_HEIGHT;
      ctx.clearRect(0, 0, W, H);

      // Soft glow behind the brain.
      const glow = ctx.createRadialGradient(
        BRAIN_CENTRE.x,
        BRAIN_CENTRE.y,
        20,
        BRAIN_CENTRE.x,
        BRAIN_CENTRE.y,
        400,
      );
      glow.addColorStop(0, `rgba(${COLORS.coreGlow},.10)`);
      glow.addColorStop(1, `rgba(${COLORS.coreGlow},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // Axons.
      for (const a of axons) {
        const { sx, sy, tx, ty } = ends(a);
        const c = control(a);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(c.x, c.y, tx, ty);
        ctx.strokeStyle = lit(a)
          ? `rgba(${COLORS.hoverGlow},.95)`
          : a.hub
            ? `rgba(${COLORS.axon},.55)`
            : `rgba(${COLORS.axon},.16)`;
        ctx.lineWidth = lit(a) ? 2 : a.hub ? 1.4 : 0.8;
        ctx.setLineDash(
          (a.target as Neuron).node?.kind === "link" ? [4, 5] : [],
        );
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Signals fire along the axons.
      if (!reduceMotion.matches && ms - lastPulse > (hover ? 140 : 320)) {
        lastPulse = ms;
        const pool = hover
          ? axons.filter(lit)
          : axons.filter((a) => a.hub || Math.random() < 0.3);
        const axon = pool[Math.floor(Math.random() * pool.length)];
        if (axon) {
          pulses.push({
            axon,
            t: 0,
            speed: 0.006 + Math.random() * 0.008,
            reverse: Math.random() < 0.5,
          });
        }
      }
      pulses = pulses.filter((p) => (p.t += p.speed) < 1);
      for (const p of pulses) {
        const t = p.reverse ? 1 - p.t : p.t;
        for (let k = 0; k < 6; k++) {
          const trail = Math.max(
            0,
            Math.min(1, t - (p.reverse ? -1 : 1) * k * 0.012),
          );
          const { x, y } = pointOn(p.axon, trail);
          ctx.beginPath();
          ctx.arc(x, y, 3.2 - k * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${COLORS.signal},${0.9 - k * 0.15})`;
          ctx.fill();
        }
      }

      // Decorative neurons.
      for (const n of neurons) {
        if (n.node) continue;
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${COLORS.axon},.45)`;
        ctx.fill();
      }

      // Topic neurons: glow, dendrites, cell body, label.
      for (const n of mapped) {
        const node = n.node!;
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        const on = n === hover;
        const core = node.kind === "core";
        const tag = node.kind === "link";
        const halo = ctx.createRadialGradient(x, y, 0, x, y, n.radius * 4);
        halo.addColorStop(
          0,
          on
            ? `rgba(${COLORS.hoverGlow},.6)`
            : core
              ? `rgba(${COLORS.coreGlow},.4)`
              : `rgba(${COLORS.axon},.28)`,
        );
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, n.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        if (!tag) {
          ctx.strokeStyle = on
            ? COLORS.hover
            : core
              ? `rgba(${COLORS.coreGlow},.85)`
              : `rgba(${COLORS.axon},.85)`;
          ctx.lineWidth = 1.3;
          for (const d of n.dendrites) {
            const sway = reduceMotion.matches
              ? 0
              : Math.sin(ms / 900 + d.phase) * 0.12;
            const a = d.angle + sway;
            const reach = n.radius * d.length;
            const x1 = x + Math.cos(a) * n.radius;
            const y1 = y + Math.sin(a) * n.radius;
            const x2 = x + Math.cos(a) * reach;
            const y2 = y + Math.sin(a) * reach;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(
              x2 + Math.cos(a + 0.6) * n.radius * 0.5,
              y2 + Math.sin(a + 0.6) * n.radius * 0.5,
            );
            ctx.moveTo(x2, y2);
            ctx.lineTo(
              x2 + Math.cos(a - 0.6) * n.radius * 0.5,
              y2 + Math.sin(a - 0.6) * n.radius * 0.5,
            );
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(x, y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = tag ? COLORS.link : core ? COLORS.core : COLORS.topic;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, n.radius * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${COLORS.ink},.35)`;
        ctx.fill();

        ctx.fillStyle = COLORS.label;
        ctx.font = `${core ? 15 : 12}px ${family}, 'Courier New', monospace`;
        ctx.textAlign = "center";
        ctx.fillText(node.label, x, y + n.radius * (tag ? 1 : 2.2) + 14);
      }
    };
    raf = requestAnimationFrame(frame);

    // Pause drawing while the map is off screen.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(canvas);

    // Pointer position in logical map coordinates, whatever the page scale.
    const toMap = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * MIND_MAP_WIDTH,
        y: ((e.clientY - rect.top) / rect.height) * MIND_MAP_HEIGHT,
      };
    };
    const nearest = (x: number, y: number) =>
      mapped.find(
        (n) => Math.hypot((n.x ?? 0) - x, (n.y ?? 0) - y) < n.radius * 2.2,
      ) ?? null;

    let dragging: Neuron | null = null;
    let downAt = { x: 0, y: 0 };
    let moved = 0;

    const onDown = (e: PointerEvent) => {
      const p = toMap(e);
      const hit = nearest(p.x, p.y);
      if (!hit) return;
      dragging = hit;
      downAt = p;
      moved = 0;
      hit.fx = hit.x;
      hit.fy = hit.y;
      canvas.setPointerCapture(e.pointerId);
      simulation.alphaTarget(0.3).restart();
    };
    const onMove = (e: PointerEvent) => {
      const p = toMap(e);
      if (dragging) {
        moved = Math.max(moved, Math.hypot(p.x - downAt.x, p.y - downAt.y));
        dragging.fx = p.x;
        dragging.fy = p.y;
        if (reduceMotion.matches) simulation.tick(3);
        return;
      }
      hover = nearest(p.x, p.y);
      canvas.style.cursor = hover?.node?.href
        ? "pointer"
        : hover
          ? "grab"
          : "default";
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      const released = dragging;
      dragging = null;
      released.fx = null;
      released.fy = null;
      simulation.alphaTarget(0);
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (moved < 5 && released.node?.href) {
        routerRef.current.push(released.node.href);
      }
    };
    const onLeave = () => {
      if (!dragging) hover = null;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      simulation.stop();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="A mind map of Bahar's interests: neuroscience, philosophy, books, architecture, computer science, biology and climbing, linking to the writing room and the study."
        className="block touch-pan-y"
        style={{ width: MIND_MAP_WIDTH, height: MIND_MAP_HEIGHT }}
      />
      {/* Keyboard and screen-reader route to the two linked rooms. */}
      <nav className="sr-only" aria-label="Mind map links">
        {MAP_NODES.filter((n) => n.href).map((n) => (
          <a key={n.id} href={n.href}>
            {n.label.replace("→ ", "")}
          </a>
        ))}
      </nav>
    </>
  );
}
