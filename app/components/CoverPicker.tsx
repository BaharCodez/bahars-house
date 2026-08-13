"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Picks a dedicated cover image for a post, separate from the images in the
 * body. Pick a file, pan (drag) and zoom (slider) to frame it in a 3:2 window,
 * then "set cover" bakes exactly that crop to a canvas and uploads it — so the
 * card and post page just render the result, no crop maths at display time.
 */
const OUT_W = 1200;
const OUT_H = 800; // 3:2

export default function CoverPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  // The image being cropped (object URL) and its loaded element for export.
  const [src, setSrc] = useState<string | null>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [vw, setVw] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Track the crop window's on-screen width so the pan/zoom maths match export.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVw(el.clientWidth));
    ro.observe(el);
    setVw(el.clientWidth);
    return () => ro.disconnect();
  }, [src]);

  // Revoke object URLs when they're replaced or the editor unmounts.
  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  // Geometry shared by preview and export: cover-fit at zoom 1, then zoom/pan.
  function geometry(width: number) {
    const height = (width * OUT_H) / OUT_W;
    if (!natural) return null;
    const base = Math.max(width / natural.w, height / natural.h);
    const scale = base * zoom;
    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    const maxX = Math.max(0, (dispW - width) / 2);
    const maxY = Math.max(0, (dispH - height) / 2);
    const ox = Math.max(-maxX, Math.min(maxX, offset.x * (width / (vw || 1))));
    const oy = Math.max(-maxY, Math.min(maxY, offset.y * (width / (vw || 1))));
    const left = (width - dispW) / 2 + ox;
    const top = (height - dispH) / 2 + oy;
    return { scale, dispW, dispH, left, top, width, height };
  }

  function clampOffset(next: { x: number; y: number }) {
    const g = geometryRaw(vw, next);
    return g ? { x: g.ox, y: g.oy } : next;
  }
  // Like geometry() but takes an explicit offset and returns the clamped px.
  function geometryRaw(width: number, off: { x: number; y: number }) {
    const height = (width * OUT_H) / OUT_W;
    if (!natural || !width) return null;
    const base = Math.max(width / natural.w, height / natural.h);
    const scale = base * zoom;
    const maxX = Math.max(0, (natural.w * scale - width) / 2);
    const maxY = Math.max(0, (natural.h * scale - height) / 2);
    return {
      ox: Math.max(-maxX, Math.min(maxX, off.x)),
      oy: Math.max(-maxY, Math.min(maxY, off.y)),
    };
  }

  function pickFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("That's not an image.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgElRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setSrc(url);
    };
    img.src = url;
  }

  function cancel() {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setNatural(null);
    imgElRef.current = null;
  }

  async function setCover() {
    const img = imgElRef.current;
    const g = geometry(vw);
    if (!img || !g || !vw) return;
    setUploading(true);
    setError(null);
    try {
      // Map the visible window back into source pixels, then draw to 3:2.
      const sx = (0 - g.left) / g.scale;
      const sy = (0 - g.top) / g.scale;
      const sW = g.width / g.scale;
      const sH = g.height / g.scale;
      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(img, sx, sy, sW, sH, 0, 0, OUT_W, OUT_H);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("export failed");
      const form = new FormData();
      form.append(
        "file",
        new File([blob], "cover.jpg", { type: "image/jpeg" }),
      );
      const uploadRes = await fetch("/api/images", {
        method: "POST",
        body: form,
      });
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        setError(data.error ?? "Couldn't save the cover.");
        return;
      }
      const { url } = (await uploadRes.json()) as { url: string };
      onChange(url);
      cancel();
    } catch {
      setError("Couldn't save the cover.");
    } finally {
      setUploading(false);
    }
  }

  const g = src ? geometry(vw) : null;

  const btn =
    "border-line text-ink-soft hover:text-ink hover:border-accent rounded border-2 px-2.5 py-1 font-mono text-xs transition-colors disabled:opacity-40";

  return (
    <div className="mt-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) pickFile(file);
        }}
      />

      {/* Editing a freshly-picked image */}
      {src && (
        <div className="border-line rounded-md border p-3">
          <div
            ref={viewportRef}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const dx = e.clientX - drag.current.x;
              const dy = e.clientY - drag.current.y;
              drag.current = { x: e.clientX, y: e.clientY };
              setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }));
            }}
            onPointerUp={() => (drag.current = null)}
            className="bg-bg-2 relative aspect-[3/2] w-full cursor-grab touch-none overflow-hidden rounded active:cursor-grabbing"
          >
            {g && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: g.left,
                  top: g.top,
                  width: g.dispW,
                  height: g.dispH,
                  maxWidth: "none",
                }}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-ink-soft font-mono text-xs">zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                setZoom(Number(e.target.value));
                setOffset((o) => clampOffset(o));
              }}
              className="accent-accent flex-1"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={setCover}
              className="bg-accent text-accent-ink font-pixel rounded-full px-4 py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "saving…" : "set cover"}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={cancel}
              className={btn}
            >
              cancel
            </button>
          </div>
          <p className="text-ink-soft/60 mt-2 font-mono text-[0.7rem]">
            drag to reposition · slide to zoom
          </p>
        </div>
      )}

      {/* Current cover, not editing */}
      {!src && value && (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Post cover"
            className="border-line aspect-[3/2] w-40 rounded-md border object-cover"
          />
          <div className="flex flex-col gap-2">
            <span className="text-ink-soft font-mono text-xs">cover image</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={btn}
              >
                change
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className={btn}
              >
                remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No cover yet */}
      {!src && !value && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="border-line text-ink-soft hover:text-ink hover:border-accent flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed py-3 font-mono text-xs transition-colors"
        >
          ＋ add a cover image
          <span className="text-ink-soft/50">
            (optional — otherwise the first image in your writing is used)
          </span>
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
