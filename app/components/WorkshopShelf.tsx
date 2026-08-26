"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Frame } from "@/app/components/HallwayWall";

// How the spines get their look — deterministic so the shelf
// renders the same on server and client.
const SPINE_COLORS = ["bg-accent", "bg-accent-2", "bg-ink-soft"];
const SPINE_HEIGHTS = ["h-28", "h-24", "h-28", "h-20", "h-24"];
const BOOKS_PER_SHELF = 6;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/* One project, standing spine-out on the shelf. */
function Spine({
  frame,
  index,
  open,
  onToggle,
}: {
  frame: Frame;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const color = SPINE_COLORS[index % SPINE_COLORS.length];
  const height = SPINE_HEIGHTS[index % SPINE_HEIGHTS.length];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={frame.title}
      className={`${color} ${height} border-shelf-edge w-9 shrink-0 overflow-hidden border-2 px-1 py-2 transition-transform hover:-translate-y-1 ${
        open ? "-translate-y-1 ring-2 ring-white/60" : ""
      }`}
    >
      <span className="font-pixel text-accent-ink max-h-full text-[10px] leading-none [writing-mode:vertical-rl]">
        {frame.title}
      </span>
    </button>
  );
}

const EMPTY_FORM = {
  kind: "sandbox",
  title: "",
  subtitle: "",
  detail: "",
  years: "",
  link: "",
};

/* The workshop bookshelf: every book is a project built by hand, no AI. */
export default function WorkshopShelf({
  frames,
  canEdit,
}: {
  frames: Frame[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFrame = frames.find((f) => f.id === openId) ?? null;
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Same reason as the hallway wall: the editor sits below the shelf, so scroll
  // to it and take the cursor there when it opens.
  useEffect(() => {
    if (!adding) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    titleRef.current?.focus({ preventScroll: true });
  }, [adding, editingId]);

  function startEdit(frame: Frame) {
    setForm({
      kind: "sandbox",
      title: frame.title,
      subtitle: frame.subtitle,
      detail: frame.detail,
      years: frame.years ?? "",
      link: frame.link ?? "",
    });
    setEditingId(frame.id);
    setAdding(true);
  }

  function closeForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAdding(false);
    setError(null);
  }

  async function shelveBook(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        editingId ? `/api/frames/${editingId}` : "/api/frames",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't shelve that one.");
        return;
      }
      closeForm();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeBook(id: string) {
    await fetch(`/api/frames/${id}`, { method: "DELETE" });
    if (openId === id) setOpenId(null);
    router.refresh();
  }

  const field =
    "border-line text-ink focus:border-accent w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
      <h2 className="font-pixel text-ink-soft mb-3 text-xs tracking-wider uppercase">
        the sandbox shelf — built by hand, no ai
      </h2>

      {frames.length > 0 ? (
        <div className="border-shelf-edge bg-shelf border-4 px-2 pt-2">
          {chunk(frames, BOOKS_PER_SHELF).map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="border-shelf-edge flex items-end gap-1.5 border-b-8 px-1 pt-1"
            >
              {row.map((frame, i) => (
                <Spine
                  key={frame.id}
                  frame={frame}
                  index={rowIndex * BOOKS_PER_SHELF + i}
                  open={frame.id === openId}
                  onToggle={() =>
                    setOpenId(frame.id === openId ? null : frame.id)
                  }
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="pixel-frame bg-surface flex flex-col items-center gap-2 p-8 text-center">
          <div className="border-shelf-edge bg-shelf flex h-16 w-24 items-end gap-1 border-4 p-1">
            <div className="bg-bg/60 h-8 w-3" />
            <div className="bg-bg/60 h-6 w-3" />
          </div>
          <p className="text-ink-soft text-sm">
            The shelf is empty — nothing has been built (by hand) yet.
          </p>
        </div>
      )}

      {/* the book pulled off the shelf */}
      {openFrame && (
        <div className="pixel-frame bg-surface relative mt-4 p-4">
          {canEdit && (
            <div className="absolute -top-2 -right-2 z-10 flex gap-1">
              <button
                type="button"
                onClick={() => startEdit(openFrame)}
                aria-label={`Edit ${openFrame.title}`}
                title="rewrite this one"
                className="text-ink-soft hover:text-accent flex h-6 w-6 items-center justify-center rounded-full border-2 border-current bg-[var(--surface)] text-xs transition-colors"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => removeBook(openFrame.id)}
                aria-label={`Take ${openFrame.title} off the shelf`}
                title="take it off the shelf"
                className="text-ink-soft flex h-6 w-6 items-center justify-center rounded-full border-2 border-current bg-[var(--surface)] text-xs transition-colors hover:text-red-500"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-baseline gap-3">
            <p className="font-pixel text-ink text-base">
              {openFrame.link ? (
                <a
                  href={openFrame.link}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-accent underline-offset-2 hover:underline"
                >
                  {openFrame.title}
                </a>
              ) : (
                openFrame.title
              )}
            </p>
            {openFrame.years && (
              <span className="text-accent-2 font-mono text-xs font-bold">
                {openFrame.years}
              </span>
            )}
          </div>
          {openFrame.subtitle && (
            <p className="text-ink mt-2 text-sm font-medium">
              {openFrame.subtitle}
            </p>
          )}
          {openFrame.detail && (
            <p className="text-ink-soft mt-1 font-mono text-xs whitespace-pre-line">
              {openFrame.detail}
            </p>
          )}
        </div>
      )}

      {/* librarian mode */}
      {canEdit && (
        <div className="mt-6">
          {adding ? (
            <form
              ref={formRef}
              onSubmit={shelveBook}
              className="pixel-frame bg-surface space-y-3 p-4"
            >
              <h3 className="font-pixel text-ink text-sm">
                {editingId ? "rewrite this one" : "shelve a project"}
              </h3>
              <input
                ref={titleRef}
                className={field}
                placeholder="Title (e.g. plant waterer, CHIP-8 emulator)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <input
                className={field}
                placeholder="One-liner (what is it?)"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
              <textarea
                className={`${field} min-h-20 resize-y`}
                placeholder="The story — what you built, what you learned, what broke. Line breaks are kept."
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
              />
              <div className="flex gap-3">
                <input
                  className={field}
                  placeholder="Years (e.g. winter 2025)"
                  value={form.years}
                  onChange={(e) => setForm({ ...form, years: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Link (optional)"
                  type="url"
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-accent text-accent-ink font-pixel rounded-full px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "saving…" : editingId ? "save changes" : "shelve it"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-ink-soft hover:text-ink px-3 text-sm"
                >
                  never mind
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="font-pixel text-ink-soft hover:text-ink border-line hover:border-accent rounded border-2 border-dashed px-4 py-2 text-sm transition-colors"
              >
                + shelve a project
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
