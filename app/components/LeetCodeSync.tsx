"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface SyncedProblem {
  url: string;
  name: string;
  pattern: string;
}

// Re-sync on arrival if the last one was longer ago than this.
const STALE_MS = 10 * 60 * 1000;

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Links the DSA board to a LeetCode account and ticks off what's been solved.
 *
 * NeetCode keeps your progress behind its own account with no public API, so
 * the thing we can actually read is the LeetCode profile it sends you to.
 * LeetCode only hands back the last ~20 accepted submissions, so this keeps
 * up from now on rather than backfilling — which is said plainly below rather
 * than left for you to notice.
 */
export default function LeetCodeSync({
  username: initialUsername,
  syncedAt: initialSyncedAt,
  onSynced,
}: {
  username: string | null;
  syncedAt: string | null;
  onSynced: (added: SyncedProblem[]) => void;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [syncedAt, setSyncedAt] = useState(initialSyncedAt);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const autoRan = useRef(false);

  // Relative time is client-only — the server has no business guessing what
  // "5 min ago" reads like in your timezone.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  async function sync() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/leetcode/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't sync just now.");
        return;
      }
      setSyncedAt(data.syncedAt);
      onSynced(data.added ?? []);
      const n = (data.added ?? []).length;
      setResult(
        n === 0
          ? data.offBoard > 0
            ? `nothing new for the board (${data.offBoard} recent solves aren't on it)`
            : "nothing new since last time"
          : `ticked off ${n} problem${n === 1 ? "" : "s"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  // On arrival, quietly catch up if it's been a while. Kicked off a tick
  // later so the first render isn't chasing its own state, and only once per
  // visit — hence the ref rather than depending on `sync` itself.
  useEffect(() => {
    if (!username || autoRan.current) return;
    const stale =
      !syncedAt || Date.now() - new Date(syncedAt).getTime() > STALE_MS;
    if (!stale) return;
    autoRan.current = true;
    const t = setTimeout(() => void sync(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, syncedAt]);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: draft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't link that account.");
        return;
      }
      setUsername(data.username);
      setDraft("");
      setEditing(false);
      autoRan.current = true;
      void sync();
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      const res = await fetch("/api/leetcode", { method: "DELETE" });
      if (res.ok) {
        setUsername(null);
        setSyncedAt(null);
        setResult(null);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!username || editing) {
    return (
      <div className="border-line mt-4 border-t pt-3">
        <form onSubmit={link} className="flex flex-wrap items-center gap-2">
          <label className="text-ink-soft font-mono text-[11px]">
            leetcode.com/u/
          </label>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="your username"
            maxLength={39}
            className="border-line text-ink focus:border-accent min-w-0 flex-1 rounded-sm border bg-transparent px-2 py-1 font-mono text-xs outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="text-accent font-mono text-[11px] hover:underline disabled:opacity-40"
          >
            {busy ? "checking…" : "link it"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="text-ink-soft hover:text-ink font-mono text-[11px]"
            >
              cancel
            </button>
          )}
        </form>
        <p className="text-ink-soft mt-2 text-xs">
          Solved problems tick themselves off. Your profile has to be public,
          and LeetCode only shares your last 20 accepted submissions — so this
          keeps up from here rather than filling in your history.
        </p>
        {error && <p className="text-accent-2 mt-2 text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="border-line text-ink-soft mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 font-mono text-[11px]">
      <a
        href={`https://leetcode.com/u/${username}/`}
        target="_blank"
        rel="noreferrer"
        className="hover:text-accent"
      >
        leetcode/{username} ↗
      </a>
      <span>
        {busy
          ? "syncing…"
          : syncedAt && mounted
            ? `synced ${ago(syncedAt)}`
            : "not synced yet"}
      </span>
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="hover:text-ink underline-offset-2 hover:underline"
      >
        sync now
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          setDraft(username);
        }}
        className="hover:text-ink"
      >
        change
      </button>
      <button type="button" onClick={unlink} className="hover:text-ink">
        unlink
      </button>
      {result && <span className="text-accent-2">{result}</span>}
      {error && <span className="text-accent-2">{error}</span>}
    </div>
  );
}
