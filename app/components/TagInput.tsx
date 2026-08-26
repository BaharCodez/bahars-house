"use client";

import { useMemo, useRef, useState } from "react";

/**
 * A chip-style topic editor. Type to filter the topics you've used before
 * (so a tag gets reused, not retyped) — Enter or comma commits, Backspace on
 * an empty field peels off the last one. Purely local; the parent decides
 * when to persist.
 */
export default function TagInput({
  value,
  suggestions,
  onChange,
}: {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag) return;
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onChange([...value, tag]);
    }
    setDraft("");
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  // Unused topics that match what's being typed — the reuse menu.
  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const used = new Set(value.map((t) => t.toLowerCase()));
    return suggestions
      .filter((s) => !used.has(s.toLowerCase()))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [draft, value, suggestions]);

  return (
    <div className="relative">
      <div
        className="border-line focus-within:border-accent flex flex-wrap items-center gap-1.5 border-b-2 py-2 transition-colors"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="text-ink-soft/60 mr-0.5 font-mono text-xs tracking-wider uppercase select-none">
          topics
        </span>
        {value.map((tag, i) => (
          <span
            key={tag}
            className="bg-accent/12 text-ink inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
              className="text-ink hover:text-accent -mr-0.5 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              removeAt(value.length - 1);
            }
          }}
          placeholder={value.length ? "add another…" : "add a topic…"}
          className="text-ink placeholder:text-ink-soft/50 min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
        />
      </div>

      {open && matches.length > 0 && (
        <ul className="border-line bg-surface absolute z-20 mt-1 max-h-56 w-full max-w-xs overflow-auto rounded-md border py-1 shadow-lg">
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                // onMouseDown so the click lands before the input's blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                }}
                className="text-ink hover:bg-accent/10 flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs"
              >
                <span className="text-accent-2">#</span>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
