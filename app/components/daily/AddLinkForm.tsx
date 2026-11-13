import { useState } from "react";
import type { ShelfState } from "./useShelf";

/** Shelve a link found elsewhere; the title falls back to the URL. */
export default function AddLinkForm({ onSave }: { onSave: ShelfState["save"] }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setError(null);
    setAdding(true);
    try {
      const result = await onSave({
        url: url.trim(),
        title: title.trim() || url.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUrl("");
      setTitle("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <form onSubmit={add} className="mt-4 space-y-2">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://… a link you found"
        className="border-line text-ink focus:border-accent w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="title (optional)"
          className="border-line text-ink focus:border-accent min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={adding || !url.trim()}
          className="font-pixel bg-accent text-accent-ink shrink-0 rounded-full px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {adding ? "…" : "add"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
