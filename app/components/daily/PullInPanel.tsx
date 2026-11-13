import { useState } from "react";
import type { PullRequest } from "./useArticleBody";

/** Shown while there's no body yet: fetching it, or the ways to get one. */
export default function PullInPanel({
  url,
  pulling,
  pullError,
  onPullIn,
}: {
  url: string;
  pulling: boolean;
  pullError: string | null;
  onPullIn: (request: PullRequest) => void;
}) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");

  if (pulling) {
    return (
      <Panel>
        <p className="text-ink-soft text-sm">
          pulling the article in from {new URL(url).hostname}…
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <p className="text-ink text-sm">
        {pullError ?? "This one hasn't been pulled in yet."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPullIn({ mode: "fetch" })}
          className="font-pixel bg-accent text-accent-ink rounded-full px-4 py-2 text-sm hover:opacity-90"
        >
          try again
        </button>
        <button
          type="button"
          onClick={() => setPasting((p) => !p)}
          className="font-pixel border-line text-ink hover:bg-ink/5 rounded-full border px-4 py-2 text-sm"
        >
          paste it in
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="font-pixel text-ink-soft hover:text-ink px-2 py-2 text-sm"
        >
          open the original ↗
        </a>
      </div>
      {pasting && (
        <div className="mt-3">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={10}
            placeholder="paste the article text here — blank lines separate paragraphs"
            className="border-line text-ink focus:border-accent w-full rounded-sm border bg-transparent p-3 text-sm outline-none"
          />
          <button
            type="button"
            disabled={!pasted.trim() || pulling}
            onClick={() => onPullIn({ mode: "paste", text: pasted })}
            className="font-pixel bg-accent text-accent-ink mt-2 rounded-full px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            save it
          </button>
        </div>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-line bg-surface rounded-sm border p-5">
      {children}
    </div>
  );
}
