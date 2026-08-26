"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface Frame {
  id: string;
  kind: string; // "job" | "project" | "achievement" | "sandbox" (workshop shelf)
  title: string;
  subtitle: string;
  detail: string;
  years: string | null;
  link: string | null;
  tags: string[];
}

const KIND_LABEL: Record<string, string> = {
  project: "project",
  job: "technical role",
  gig: "other job",
  achievement: "achievement",
};

/* Owner-only edit / remove controls for a frame. */
function FrameControls({
  frame,
  onEdit,
  onRemove,
}: {
  frame: Frame;
  onEdit: (frame: Frame) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <span className="ml-2 flex shrink-0 items-center">
      {/* Roomy padding, not a bigger glyph: a bare ✎ is a ~12px tap target,
          which is a coin toss on a phone. */}
      <button
        type="button"
        onClick={() => onEdit(frame)}
        aria-label={`Edit ${frame.title}`}
        title="rewrite this frame"
        className="text-ink-soft hover:text-accent px-2 py-2 text-xs transition-colors"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={() => onRemove(frame.id)}
        aria-label={`Take down ${frame.title}`}
        title="take this frame down"
        className="text-ink-soft px-2 py-2 text-xs transition-colors hover:text-[#9B4E2E]"
      >
        ✕
      </button>
    </span>
  );
}

/* An expandable frame in the "made & done" column (interests-accordion style). */
function AccordionFrame({
  frame,
  isOpen,
  onToggle,
  canEdit,
  onEdit,
  onRemove,
}: {
  frame: Frame;
  isOpen: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onEdit: (frame: Frame) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="border-line border-b">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          className="group flex flex-1 items-center justify-between gap-3 py-3 text-left"
        >
          <span
            className={`font-serif text-base transition-colors ${
              isOpen ? "text-accent" : "text-ink group-hover:text-accent"
            }`}
          >
            {frame.title}
          </span>
          <span className="text-accent-2 shrink-0 font-mono text-lg">
            {isOpen ? "−" : "+"}
          </span>
        </button>
        {canEdit && (
          <FrameControls frame={frame} onEdit={onEdit} onRemove={onRemove} />
        )}
      </div>
      {isOpen && (
        <div className="fade-up pb-4">
          {frame.years && (
            <p className="text-accent-2 mb-1 font-mono text-xs font-bold">
              {frame.years}
            </p>
          )}
          {frame.subtitle && (
            <p className="text-ink text-sm leading-relaxed">{frame.subtitle}</p>
          )}
          {frame.detail && (
            <p className="text-ink-soft mt-2 font-mono text-xs leading-relaxed whitespace-pre-line">
              {frame.detail}
            </p>
          )}
          {frame.link && (
            <a
              href={frame.link}
              target="_blank"
              rel="noreferrer"
              className="text-accent mt-3 inline-block font-mono text-xs hover:underline"
            >
              visit ↗
            </a>
          )}
          {frame.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {frame.tags.map((t) => (
                <span key={t} className="text-accent-2 font-mono text-xs">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  kind: "project",
  title: "",
  subtitle: "",
  detail: "",
  years: "",
  link: "",
  tags: "", // comma-separated in the form; sent as an array
};

export default function HallwayWall({
  frames,
  canEdit,
}: {
  frames: Frame[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // The editor lives at the foot of the wall, well below the frame you clicked
  // ✎ on — so bring it into view and put the cursor in it. Without this the
  // edit button looks broken: the form opens off-screen and nothing seems to
  // happen.
  useEffect(() => {
    if (!adding) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    titleRef.current?.focus({ preventScroll: true });
  }, [adding, editingId]);

  const visible = filter
    ? frames.filter((f) => f.tags?.includes(filter))
    : frames;
  const jobs = visible.filter((f) => f.kind === "job");
  const gigs = visible.filter((f) => f.kind === "gig");
  const projects = visible.filter((f) => f.kind === "project");
  const achievements = visible.filter((f) => f.kind === "achievement");

  // Filter the wall by the tags that actually appear on it.
  const allTags = Array.from(
    new Set(frames.flatMap((f) => f.tags ?? [])),
  ).sort();

  function startEdit(frame: Frame) {
    setForm({
      kind: frame.kind,
      title: frame.title,
      subtitle: frame.subtitle,
      detail: frame.detail,
      years: frame.years ?? "",
      link: frame.link ?? "",
      tags: frame.tags.join(", "),
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

  async function hangFrame(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const res = await fetch(
        editingId ? `/api/frames/${editingId}` : "/api/frames",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't hang that frame.");
        return;
      }
      closeForm();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeFrame(id: string) {
    const res = await fetch(`/api/frames/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setError("Sign in as the owner to change the wall.");
  }

  const field =
    "border-line text-ink focus:border-accent w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none";
  const pill = (active: boolean) =>
    `font-mono text-xs rounded-full px-3 py-1.5 transition-colors ${
      active
        ? "bg-accent text-accent-ink"
        : "border-line text-ink-soft hover:text-ink border"
    }`;
  const accordionList = (list: Frame[]) =>
    list.length > 0 ? (
      <div>
        {list.map((f) => (
          <AccordionFrame
            key={f.id}
            frame={f}
            isOpen={openId === f.id}
            onToggle={() => setOpenId(openId === f.id ? null : f.id)}
            canEdit={canEdit}
            onEdit={startEdit}
            onRemove={removeFrame}
          />
        ))}
      </div>
    ) : (
      <p className="text-ink-soft text-sm italic">nothing here yet</p>
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pt-6 pb-16 sm:px-8">
      {/* filter by tag */}
      {allTags.length > 0 && (
        <div className="mb-10 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={pill(filter === null)}
          >
            everything
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(filter === t ? null : t)}
              className={pill(filter === t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {frames.length === 0 ? (
        <div className="border-line bg-surface rounded-sm border p-8 text-center">
          <p className="text-ink-soft text-sm">
            The wall is bare. Nothing has been hung up yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          {/* projects, then achievements below */}
          <div>
            <h2 className="text-accent-2 mb-5 font-mono text-xs tracking-[0.2em] uppercase">
              projects
            </h2>
            {accordionList(projects)}

            <h2 className="text-accent-2 mt-10 mb-5 font-mono text-xs tracking-[0.2em] uppercase">
              achievements
            </h2>
            {accordionList(achievements)}
          </div>

          {/* work: technical experience, then other jobs */}
          <div>
            <h2 className="text-accent-2 mb-5 font-mono text-xs tracking-[0.2em] uppercase">
              technical experience
            </h2>
            {accordionList(jobs)}

            <h2 className="text-accent-2 mt-10 mb-5 font-mono text-xs tracking-[0.2em] uppercase">
              jobs I&apos;ve worked
            </h2>
            {accordionList(gigs)}
          </div>
        </div>
      )}

      {/* curator mode */}
      {canEdit && (
        <div className="mt-12">
          {adding ? (
            <form
              ref={formRef}
              onSubmit={hangFrame}
              className="border-line bg-surface space-y-3 rounded-sm border p-4"
            >
              <div className="flex items-center gap-3">
                <h3 className="text-ink font-serif text-base">
                  {editingId ? "rewrite this frame" : "hang a new frame"}
                </h3>
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="border-line text-ink ml-auto rounded-lg border bg-transparent px-2 py-1 text-sm outline-none"
                >
                  {Object.entries(KIND_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                ref={titleRef}
                className={field}
                placeholder="Title (e.g. UserTesting — QA Engineer, or ESP32 plant waterer)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <input
                className={field}
                placeholder="One-liner (what was it / what did you do?)"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
              <textarea
                className={`${field} min-h-20 resize-y`}
                placeholder="Small print — tech, outcome, the story. As many words as you like; line breaks are kept."
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
              />
              <div className="flex gap-3">
                <input
                  className={field}
                  placeholder="Years (e.g. 2023–now)"
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
              <input
                className={field}
                placeholder="Tags, comma-separated (e.g. react, python, iot)"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
              {error && <p className="text-sm text-[#9B4E2E]">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-accent text-accent-ink rounded-full px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "saving…" : editingId ? "save changes" : "hang it up"}
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
                className="text-ink-soft hover:text-ink border-line hover:border-accent rounded-full border border-dashed px-4 py-2 font-mono text-xs transition-colors"
              >
                + hang a frame
              </button>
            </div>
          )}
          {error && !adding && (
            <p className="text-accent-2 mt-3 text-center text-xs">{error}</p>
          )}
        </div>
      )}

      {!canEdit && (
        <p className="text-ink-soft mt-12 text-center font-mono text-xs">
          <Link href="/login" className="text-accent hover:underline">
            sign in
          </Link>{" "}
          as the owner to curate the wall.
        </p>
      )}
    </div>
  );
}
