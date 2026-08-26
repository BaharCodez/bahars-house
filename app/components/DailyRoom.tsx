"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SpanishLine, SpanishScene } from "@/app/lib/spanish";
import { GRASP_LABEL, type Grasp } from "./ArticleReader";

// Mirror of the server-side DailyArticle shape (feeds.ts is server-only).
interface Article {
  source: string;
  title: string;
  url: string;
}

interface Tick {
  kind: string;
  day: string;
}

interface Bookmark {
  id: string;
  url: string;
  title: string;
  source: string;
  favorite: boolean;
  // Which shelf it sits on; "" is the catch-all.
  shelf: string;
  // True once the article's body has been pulled in and can be read here.
  pulledIn?: boolean;
}

// A passage marked up on the reading desk that didn't fully land.
interface FuzzyMark {
  id: string;
  quote: string;
  note: string;
  grasp: Grasp;
  bookmarkId: string;
  bookmarkTitle: string;
}

/* Local calendar date — follows the visitor's clock, not the server's. */
function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* The default Spanish voice is often the muffled "compact" one — rank the
   installed voices and take the clearest on offer. */
function pickSpanishVoice() {
  const voices = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("es"));
  const score = (v: SpeechSynthesisVoice) =>
    (/google/i.test(v.name) ? 4 : 0) +
    (/enhanced|premium|natural/i.test(v.name) ? 3 : 0) +
    (/m[oó]nica|paulina/i.test(v.name) ? 2 : 0) +
    (/^es-(ES|MX|US)$/i.test(v.lang) ? 1 : 0);
  return voices.sort((a, b) => score(b) - score(a))[0] ?? null;
}

/* Read a line aloud with the browser's built-in Spanish voice. */
function speakSpanish(text: string, rate: number) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const speakNow = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    u.rate = rate;
    const voice = pickSpanishVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    synth.speak(u);
  };
  // The voice list loads async — first click can land before it's ready.
  if (synth.getVoices().length === 0) {
    let spoken = false;
    const go = () => {
      if (!spoken) {
        spoken = true;
        speakNow();
      }
    };
    synth.addEventListener("voiceschanged", go, { once: true });
    setTimeout(go, 300);
  } else {
    speakNow();
  }
}

export default function DailyRoom({
  article,
  scene,
  listening,
  ticks: initialTicks,
  bookmarks: initialBookmarks,
  marks,
  fuzzy,
  canEdit,
  serverDay,
}: {
  article: Article | null;
  scene: SpanishScene;
  listening: SpanishLine;
  ticks: Tick[];
  bookmarks: Bookmark[];
  // Per-article tallies of how the passages landed, keyed by bookmark id.
  marks: Record<string, Record<Grasp, number>>;
  fuzzy: FuzzyMark[];
  canEdit: boolean;
  serverDay: string;
}) {
  const router = useRouter();
  const [ticks, setTicks] = useState(initialTicks);
  const [shelf, setShelf] = useState(initialBookmarks);
  const [fuzzyList, setFuzzyList] = useState(fuzzy);
  const [savingArticle, setSavingArticle] = useState(false);
  const [openingDesk, setOpeningDesk] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // SSR says no (there's no window); the real answer arrives on hydration.
  const canSpeak = useSyncExternalStore(
    () => () => {},
    () => "speechSynthesis" in window,
    () => false,
  );

  // SSR renders with the server's date; the visitor's clock takes over on
  // hydration (string snapshots compare by value, so this stays stable).
  const today = useSyncExternalStore(
    () => () => {},
    () => localDay(),
    () => serverDay,
  );

  const done = useMemo(
    () => new Set(ticks.map((t) => `${t.kind}:${t.day}`)),
    [ticks],
  );

  async function tick(kind: "article" | "spanish" | "listening") {
    if (done.has(`${kind}:${today}`) || busy) return;
    setBusy(kind);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, day: today }),
      });
      if (res.ok) setTicks((t) => [...t, { kind, day: today }]);
    } finally {
      setBusy(null);
    }
  }

  // The shelf, split into the special pile (starred) and the rest.
  const shelved = useMemo(() => new Set(shelf.map((b) => b.url)), [shelf]);
  const pile = shelf.filter((b) => b.favorite);
  const rest = shelf.filter((b) => !b.favorite);

  // The unstarred reads, grouped into the shelves they've been put on.
  // Named shelves first (alphabetical), the catch-all last.
  const shelves = useMemo(() => {
    const groups = new Map<string, Bookmark[]>();
    for (const b of rest) {
      const name = b.shelf ?? "";
      const list = groups.get(name) ?? [];
      list.push(b);
      groups.set(name, list);
    }
    return [...groups.entries()].sort(([a], [b]) =>
      a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
    );
  }, [rest]);

  // Every shelf name in use, for the "move to" menu.
  const shelfNames = useMemo(
    () =>
      [...new Set(shelf.map((b) => b.shelf).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [shelf],
  );

  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [addingLink, setAddingLink] = useState(false);
  // Which read is having its shelf changed (the inline "move to" row).
  const [moving, setMoving] = useState<string | null>(null);
  const [newShelf, setNewShelf] = useState("");
  // Surfaced when a shelf write bounces (usually: not signed in as owner).
  const [shelfNote, setShelfNote] = useState<string | null>(null);

  // Add a bookmark; on success prepend it to the shelf. Returns ok/reason.
  async function saveBookmark(input: {
    url: string;
    title: string;
    source?: string;
  }) {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false as const, error: data.error ?? "Couldn't save that." };
    }
    const saved: Bookmark = await res.json();
    setShelf((s) => (s.some((b) => b.id === saved.id) ? s : [saved, ...s]));
    return { ok: true as const, bookmark: saved };
  }

  async function saveArticle() {
    if (!article || savingArticle || shelved.has(article.url)) return;
    setSavingArticle(true);
    setShelfNote(null);
    try {
      const result = await saveBookmark({
        url: article.url,
        title: article.title,
        source: article.source,
      });
      if (!result.ok) setShelfNote(result.error);
    } finally {
      setSavingArticle(false);
    }
  }

  // Read today's article at the desk instead of in a tab: it has to be on the
  // shelf first (that's what the highlights hang off), so shelve it and go.
  async function readAtDesk() {
    if (!article || openingDesk) return;
    const already = shelf.find((b) => b.url === article.url);
    if (already) {
      router.push(`/daily/read/${already.id}`);
      return;
    }
    setOpeningDesk(true);
    setShelfNote(null);
    try {
      const result = await saveBookmark({
        url: article.url,
        title: article.title,
        source: article.source,
      });
      if (result.ok) router.push(`/daily/read/${result.bookmark.id}`);
      else setShelfNote(result.error);
    } finally {
      setOpeningDesk(false);
    }
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (addingLink) return;
    setLinkErr(null);
    setAddingLink(true);
    try {
      const result = await saveBookmark({
        url: linkUrl.trim(),
        title: linkTitle.trim() || linkUrl.trim(),
      });
      if (result.ok) {
        setLinkUrl("");
        setLinkTitle("");
      } else {
        setLinkErr(result.error);
      }
    } finally {
      setAddingLink(false);
    }
  }

  async function toggleFavorite(b: Bookmark) {
    const next = !b.favorite;
    setShelf((s) =>
      s.map((x) => (x.id === b.id ? { ...x, favorite: next } : x)),
    );
    const res = await fetch(`/api/bookmarks/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: next }),
    });
    if (!res.ok) {
      // Roll back if the house said no.
      setShelf((s) =>
        s.map((x) => (x.id === b.id ? { ...x, favorite: b.favorite } : x)),
      );
      setShelfNote("Sign in as the owner to change the shelf.");
    }
  }

  // Drop a fuzzy mark from the pile — the "I get this now" ×. It deletes the
  // highlight itself, so it goes from the article too.
  async function forgetMark(id: string) {
    const prev = fuzzyList;
    setFuzzyList((f) => f.filter((h) => h.id !== id));
    const res = await fetch(`/api/highlights/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setFuzzyList(prev);
      setShelfNote("Sign in as the owner to change your notes.");
    }
  }

  // Move a read to another shelf. "" puts it back on the catch-all.
  async function moveToShelf(b: Bookmark, name: string) {
    setMoving(null);
    setNewShelf("");
    if ((b.shelf ?? "") === name) return;
    setShelf((s) => s.map((x) => (x.id === b.id ? { ...x, shelf: name } : x)));
    const res = await fetch(`/api/bookmarks/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelf: name }),
    });
    if (!res.ok) {
      setShelf((s) =>
        s.map((x) => (x.id === b.id ? { ...x, shelf: b.shelf } : x)),
      );
      setShelfNote("Sign in as the owner to change the shelf.");
    }
  }

  async function removeBookmark(b: Bookmark) {
    const prev = shelf;
    setShelf((s) => s.filter((x) => x.id !== b.id));
    const res = await fetch(`/api/bookmarks/${b.id}`, { method: "DELETE" });
    if (!res.ok) {
      setShelf(prev);
      setShelfNote("Sign in as the owner to change the shelf.");
    }
  }

  function bookmarkRow(b: Bookmark) {
    const tally = marks[b.id];
    return (
      <li
        key={b.id}
        className="border-line flex items-start gap-2 border-b py-2 last:border-0"
      >
        <button
          type="button"
          onClick={() => toggleFavorite(b)}
          title={b.favorite ? "in the pile" : "add to the pile"}
          className="text-accent shrink-0 pt-0.5 text-sm"
        >
          {b.favorite ? "★" : "☆"}
        </button>
        <div className="min-w-0 flex-1">
          {b.source && (
            <p className="text-accent-2 font-mono text-[10px] font-bold">
              {b.source}
            </p>
          )}
          <a
            href={b.url}
            target="_blank"
            rel="noreferrer"
            className="text-ink hover:text-accent block truncate text-sm underline-offset-4 hover:underline"
          >
            {b.title} ↗
          </a>
          {/* the desk is hers alone — it caches the article to mark up */}
          {canEdit && (
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Link
                href={`/daily/read/${b.id}`}
                className="text-accent font-mono text-[11px] hover:underline"
              >
                {b.pulledIn ? "read here →" : "read it here →"}
              </Link>
              {tally && (
                <span className="text-ink-soft font-mono text-[11px]">
                  <span className="hl hl-got px-1">{tally.got}</span>{" "}
                  <span className="hl hl-half px-1">{tally.half}</span>{" "}
                  <span className="hl hl-lost px-1">{tally.lost}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setMoving((m) => (m === b.id ? null : b.id));
                  setNewShelf("");
                }}
                className="text-ink-soft hover:text-ink font-mono text-[11px]"
              >
                {moving === b.id ? "cancel" : "move →"}
              </button>
            </div>
          )}

          {/* pick an existing shelf, or name a new one */}
          {canEdit && moving === b.id && (
            <div className="border-line bg-bg-2/40 fade-up mt-2 rounded-sm border p-2">
              <div className="flex flex-wrap gap-1">
                {shelfNames
                  .filter((name) => name !== b.shelf)
                  .map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => moveToShelf(b, name)}
                      className="border-line text-ink hover:border-accent hover:text-accent rounded-full border px-2.5 py-1 font-mono text-[11px]"
                    >
                      {name}
                    </button>
                  ))}
                {b.shelf && (
                  <button
                    type="button"
                    onClick={() => moveToShelf(b, "")}
                    className="text-ink-soft hover:text-ink rounded-full px-2.5 py-1 font-mono text-[11px]"
                  >
                    off this shelf
                  </button>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newShelf.trim();
                  if (name) moveToShelf(b, name);
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  type="text"
                  value={newShelf}
                  onChange={(e) => setNewShelf(e.target.value)}
                  maxLength={40}
                  placeholder="or a new shelf…"
                  className="border-line text-ink focus:border-accent min-w-0 flex-1 rounded-sm border bg-transparent px-2 py-1 text-xs outline-none"
                />
                <button
                  type="submit"
                  disabled={!newShelf.trim()}
                  className="text-accent font-mono text-[11px] hover:underline disabled:opacity-40"
                >
                  shelve it
                </button>
              </form>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => removeBookmark(b)}
          title="remove from the shelf"
          className="text-ink hover:text-accent shrink-0 text-sm"
        >
          ×
        </button>
      </li>
    );
  }

  const articleDone = done.has(`article:${today}`);
  const articleSaved = article ? shelved.has(article.url) : false;
  const spanishDone = done.has(`spanish:${today}`);
  const listeningDone = done.has(`listening:${today}`);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-12 sm:px-6">
      {/* today's read */}
      <section className="pixel-frame bg-surface p-4 sm:p-5">
        <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
          today&apos;s read
        </h2>
        {article ? (
          <>
            <p className="text-accent-2 mt-3 font-mono text-xs font-bold">
              {article.source}
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="font-pixel text-ink hover:text-accent mt-1 block text-lg leading-snug underline-offset-4 hover:underline"
            >
              {article.title} ↗
            </a>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => tick("article")}
                disabled={articleDone || busy === "article"}
                className={`font-pixel rounded-full px-4 py-2 text-sm transition-opacity ${
                  articleDone
                    ? "bg-accent/30 text-ink cursor-default"
                    : "bg-accent text-accent-ink hover:opacity-90"
                }`}
              >
                {articleDone
                  ? "read ✓"
                  : busy === "article"
                    ? "…"
                    : "I read it"}
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={readAtDesk}
                  disabled={openingDesk}
                  title="read it here and highlight as you go"
                  className="font-pixel border-accent text-accent hover:bg-accent/10 rounded-full border px-4 py-2 text-sm transition-colors"
                >
                  {openingDesk ? "…" : "read it here →"}
                </button>
              )}
              <button
                type="button"
                onClick={saveArticle}
                disabled={articleSaved || savingArticle}
                title={
                  articleSaved ? "already on the shelf" : "save to the shelf"
                }
                className={`font-pixel border-line rounded-full border px-4 py-2 text-sm transition-opacity ${
                  articleSaved
                    ? "text-ink-soft cursor-default"
                    : "text-ink hover:bg-ink/5"
                }`}
              >
                {articleSaved
                  ? "★ shelved"
                  : savingArticle
                    ? "…"
                    : "☆ save to shelf"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-ink-soft mt-3 text-sm">
            The newsstand is empty — couldn&apos;t reach the feeds. Come back in
            a bit.
          </p>
        )}
      </section>

      {/* today's spanish */}
      <section className="pixel-frame bg-surface p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
            hoy: un poco de español
          </h2>
          <span className="text-ink-soft font-mono text-xs">
            scene: {scene.scene}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {scene.lines.map((line, i) => (
            <div key={i} className={i % 2 === 0 ? "" : "pl-4 sm:pl-6"}>
              <p className="text-ink text-sm font-medium">{line.es}</p>
              {showEnglish && (
                <p className="text-ink-soft text-xs">{line.en}</p>
              )}
            </div>
          ))}
        </div>

        <div className="border-accent bg-accent/10 mt-4 border-l-4 p-3">
          <p className="font-pixel text-ink-soft text-[10px] tracking-wider uppercase">
            your turn — say it out loud, once is enough
          </p>
          <p className="text-ink mt-1 text-sm font-medium">
            {scene.yourTurn.es}
          </p>
          {showEnglish && (
            <p className="text-ink-soft text-xs">{scene.yourTurn.en}</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowEnglish((s) => !s)}
            className="font-pixel text-ink-soft hover:text-ink border-line hover:border-accent rounded border-2 border-dashed px-3 py-2 text-xs transition-colors"
          >
            {showEnglish ? "hide english" : "show english"}
          </button>
          <button
            type="button"
            onClick={() => tick("spanish")}
            disabled={spanishDone || busy === "spanish"}
            className={`font-pixel rounded-full px-4 py-2 text-sm transition-opacity ${
              spanishDone
                ? "bg-accent/30 text-ink cursor-default"
                : "bg-accent text-accent-ink hover:opacity-90"
            }`}
          >
            {spanishDone ? "hecho ✓" : busy === "spanish" ? "…" : "¡hecho!"}
          </button>
        </div>
      </section>

      {/* today's listening */}
      <section className="pixel-frame bg-surface p-4 sm:p-5">
        <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
          el oído — just listen
        </h2>
        <p className="text-ink-soft mt-2 text-sm">
          One sentence, ears only. Play it a few times before you peek.
        </p>

        {canSpeak ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => speakSpanish(listening.es, 0.9)}
              className="bg-accent-2 text-accent-ink font-pixel rounded-full px-4 py-2 text-sm hover:opacity-90"
            >
              ▶ listen
            </button>
            <button
              type="button"
              onClick={() => speakSpanish(listening.es, 0.6)}
              className="font-pixel text-ink-soft hover:text-ink border-line hover:border-accent rounded border-2 border-dashed px-3 py-2 text-xs transition-colors"
            >
              🐢 slower
            </button>
          </div>
        ) : (
          <p className="text-ink-soft mt-4 font-mono text-xs">
            (this browser can&apos;t speak — reveal and read instead)
          </p>
        )}

        {revealed ? (
          <div className="border-accent-2 bg-accent-2/10 mt-4 border-l-4 p-3">
            <p className="text-ink text-sm font-medium">{listening.es}</p>
            <p className="text-ink-soft mt-1 text-xs">{listening.en}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="font-pixel text-ink-soft hover:text-ink border-line hover:border-accent mt-4 block rounded border-2 border-dashed px-3 py-2 text-xs transition-colors"
          >
            reveal the sentence
          </button>
        )}

        <button
          type="button"
          onClick={() => tick("listening")}
          disabled={listeningDone || busy === "listening"}
          className={`font-pixel mt-4 rounded-full px-4 py-2 text-sm transition-opacity ${
            listeningDone
              ? "bg-accent/30 text-ink cursor-default"
              : "bg-accent text-accent-ink hover:opacity-90"
          }`}
        >
          {listeningDone
            ? "entendido ✓"
            : busy === "listening"
              ? "…"
              : "¡entendido!"}
        </button>
      </section>

      {/* the shelf — articles worth keeping (a running dissertation pile) */}
      <section className="pixel-frame bg-surface p-4 sm:p-5">
        <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
          the shelf
        </h2>
        <p className="text-ink-soft mt-1 text-xs">
          reads worth keeping. star the best into the pile, and use{" "}
          <span className="font-mono">move →</span> to sort the rest onto
          shelves of your own.
        </p>
        {shelfNote && (
          <p className="text-accent-2 mt-2 text-xs font-medium">{shelfNote}</p>
        )}

        <form onSubmit={addLink} className="mt-4 space-y-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://… a link you found"
            className="border-line text-ink focus:border-accent w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="title (optional)"
              className="border-line text-ink focus:border-accent min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={addingLink || !linkUrl.trim()}
              className="font-pixel bg-accent text-accent-ink shrink-0 rounded-full px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {addingLink ? "…" : "add"}
            </button>
          </div>
          {linkErr && (
            <p className="text-sm text-red-600 dark:text-red-400">{linkErr}</p>
          )}
        </form>

        {pile.length > 0 && (
          <div className="mt-5">
            <h3 className="font-pixel text-accent text-[11px] tracking-wider uppercase">
              ★ the pile
            </h3>
            <ul className="mt-2">{pile.map(bookmarkRow)}</ul>
          </div>
        )}

        {/* one section per shelf, catch-all last */}
        {rest.length > 0 ? (
          shelves.map(([name, reads]) => (
            <div key={name || "—"} className="mt-5">
              <h3 className="font-pixel text-ink-soft text-[11px] tracking-wider uppercase">
                {name || "on the shelf"}
                <span className="ml-2 font-mono normal-case">
                  {reads.length}
                </span>
              </h3>
              <ul className="mt-2">{reads.map(bookmarkRow)}</ul>
            </div>
          ))
        ) : (
          <div className="mt-5">
            <h3 className="font-pixel text-ink-soft text-[11px] tracking-wider uppercase">
              on the shelf
            </h3>
            <p className="text-ink-soft mt-2 text-sm">
              {shelf.length === 0
                ? "Nothing shelved yet. Save a read above."
                : "Everything here is in the pile."}
            </p>
          </div>
        )}
      </section>

      {/* everything across the shelf that only half landed */}
      {canEdit && (
        <section className="pixel-frame bg-surface p-4 sm:p-5">
          <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
            what I don&apos;t get yet
          </h2>
          <p className="text-ink-soft mt-1 text-xs">
            the passages you marked amber or red while reading. re-read one and
            it moves.
          </p>
          {fuzzyList.length === 0 ? (
            <p className="text-ink-soft mt-3 text-sm">
              Nothing fuzzy on the shelf. Read one at the desk and highlight as
              you go.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {fuzzyList.map((h) => (
                <li
                  key={h.id}
                  className="border-line border-b pb-3 last:border-0"
                >
                  <p className={`hl hl-${h.grasp} text-ink inline text-sm`}>
                    “{h.quote}”
                  </p>
                  {h.note && (
                    <p className="text-ink-soft mt-1 text-sm italic">
                      {h.note}
                    </p>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <Link
                      href={`/daily/read/${h.bookmarkId}`}
                      className="text-ink-soft hover:text-accent min-w-0 flex-1 truncate font-mono text-[11px]"
                    >
                      {GRASP_LABEL[h.grasp]} · {h.bookmarkTitle} →
                    </Link>
                    <button
                      type="button"
                      onClick={() => forgetMark(h.id)}
                      title="I get this now — drop the mark"
                      className="text-ink-soft hover:text-ink shrink-0 font-mono text-[11px]"
                    >
                      got it now ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
