import { useState } from "react";
import { useRouter } from "next/navigation";
import TickButton from "./TickButton";
import type { DailyArticle, TickControl } from "./types";
import type { ShelfState } from "./useShelf";

export default function TodaysRead({
  article,
  canEdit,
  shelf,
  read,
}: {
  article: DailyArticle | null;
  canEdit: boolean;
  shelf: ShelfState;
  read: TickControl;
}) {
  return (
    <section className="pixel-frame bg-surface p-4 sm:p-5">
      <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
        today&apos;s read
      </h2>
      {article ? (
        <ArticleOfTheDay
          article={article}
          canEdit={canEdit}
          shelf={shelf}
          read={read}
        />
      ) : (
        <p className="text-ink-soft mt-3 text-sm">
          The newsstand is empty — couldn&apos;t reach the feeds. Come back in a
          bit.
        </p>
      )}
    </section>
  );
}

function ArticleOfTheDay({
  article,
  canEdit,
  shelf,
  read,
}: {
  article: DailyArticle;
  canEdit: boolean;
  shelf: ShelfState;
  read: TickControl;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [openingDesk, setOpeningDesk] = useState(false);
  const shelved = shelf.bookmarks.find((b) => b.url === article.url);

  const saveToShelf = () =>
    shelf.save({
      url: article.url,
      title: article.title,
      source: article.source,
    });

  async function save() {
    if (saving || shelved) return;
    setSaving(true);
    shelf.setNote(null);
    try {
      const result = await saveToShelf();
      if (!result.ok) shelf.setNote(result.error);
    } finally {
      setSaving(false);
    }
  }

  // Read today's article at the desk instead of in a tab: it has to be on the
  // shelf first (that's what the highlights hang off), so shelve it and go.
  async function readAtDesk() {
    if (openingDesk) return;
    if (shelved) {
      router.push(`/daily/read/${shelved.id}`);
      return;
    }
    setOpeningDesk(true);
    shelf.setNote(null);
    try {
      const result = await saveToShelf();
      if (result.ok) router.push(`/daily/read/${result.bookmark.id}`);
      else shelf.setNote(result.error);
    } finally {
      setOpeningDesk(false);
    }
  }

  return (
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
        <TickButton {...read} idleLabel="I read it" doneLabel="read ✓" />
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
          onClick={save}
          disabled={!!shelved || saving}
          title={shelved ? "already on the shelf" : "save to the shelf"}
          className={`font-pixel border-line rounded-full border px-4 py-2 text-sm transition-opacity ${
            shelved ? "text-ink-soft cursor-default" : "text-ink hover:bg-ink/5"
          }`}
        >
          {shelved ? "★ shelved" : saving ? "…" : "☆ save to shelf"}
        </button>
      </div>
    </>
  );
}
