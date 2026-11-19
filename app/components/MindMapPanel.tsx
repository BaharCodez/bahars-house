"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addNode,
  connect,
  deleteNode,
  disconnect,
  patchNode,
} from "@/app/lib/mapApi";
import type { MapLink, MapNode } from "@/app/lib/mindMap";

// The side panel that opens when a node is clicked. Everyone can read it; the
// editing controls only render for the signed-in owner (and every change is
// checked again on the server).

type Props = {
  node: MapNode;
  neighbours: { node: MapNode; edgeId: string }[];
  /** Nodes this one could still be connected to. */
  others: MapNode[];
  canEdit: boolean;
  onSelect: (id: string | null) => void;
  /** Re-read the map after a change. */
  onChanged: () => void;
};

const field =
  "w-full rounded-md border border-line bg-bg px-2 py-1.5 text-[15px] text-ink outline-none focus:border-accent";
const button =
  "rounded-md border border-line px-3 py-1.5 font-mono text-[13px] text-ink transition-colors hover:bg-bg-2 disabled:opacity-40";

function LinkRow({ link }: { link: MapLink }) {
  const internal = link.href.startsWith("/");
  const cls =
    "block rounded-md border border-line px-3 py-2 text-[15px] text-accent transition-colors hover:bg-bg-2";
  return internal ? (
    <Link href={link.href} className={cls}>
      {link.label} →
    </Link>
  ) : (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
    >
      {link.label} ↗
    </a>
  );
}

export default function MindMapPanel({
  node,
  neighbours,
  others,
  canEdit,
  onSelect,
  onChanged,
}: Props) {
  const [label, setLabel] = useState(node.label);
  const [note, setNote] = useState(node.note);
  const [links, setLinks] = useState<MapLink[]>(node.links);
  const [childLabel, setChildLabel] = useState("");
  const [joinTo, setJoinTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dirty =
    label !== node.label ||
    note !== node.note ||
    JSON.stringify(links) !== JSON.stringify(node.links);

  // Run one edit, then re-read the map. Errors show in the panel.
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const title = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-accent-2 font-mono text-[12px] tracking-[0.18em] uppercase">
          {node.kind === "core" ? "centre" : node.kind}
        </p>
        {!canEdit && (
          <h2 className="text-ink mt-1 font-serif text-[28px] leading-tight">
            {node.label}
          </h2>
        )}
      </div>
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-label="Close"
        className="text-ink-soft hover:text-ink text-[22px] leading-none"
      >
        ×
      </button>
    </div>
  );

  const connectedTo = (
    <div className="mt-5">
      <p className="text-ink-soft font-mono text-[12px] tracking-[0.18em] uppercase">
        connected to
      </p>
      {neighbours.length === 0 && (
        <p className="text-ink-soft mt-2 text-[15px]">Nothing yet.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {neighbours.map(({ node: n, edgeId }) => (
          <span
            key={edgeId}
            className="border-line inline-flex items-center overflow-hidden rounded-full border text-[14px]"
          >
            <button
              type="button"
              onClick={() => onSelect(n.id)}
              className="text-ink hover:bg-bg-2 px-3 py-1"
            >
              {n.label}
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={busy}
                aria-label={`Disconnect ${n.label}`}
                onClick={() => run(() => disconnect(edgeId))}
                className="text-ink-soft hover:text-ink border-line border-l px-2 py-1"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );

  if (!canEdit) {
    return (
      <>
        {title}
        {node.note ? (
          <p className="text-ink mt-4 text-[16px] leading-relaxed whitespace-pre-wrap">
            {node.note}
          </p>
        ) : (
          <p className="text-ink-soft mt-4 text-[15px] italic">
            Nothing written here yet.
          </p>
        )}
        {node.links.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            {node.links.map((l, i) => (
              <LinkRow key={i} link={l} />
            ))}
          </div>
        )}
        {connectedTo}
      </>
    );
  }

  return (
    <>
      {title}
      <label className="mt-2 block">
        <span className="sr-only">Name</span>
        <input
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          className={`${field} font-serif text-[22px]`}
        />
      </label>
      <label className="mt-3 block">
        <span className="text-ink-soft font-mono text-[12px] tracking-[0.18em] uppercase">
          note
        </span>
        <textarea
          value={note}
          maxLength={2000}
          rows={6}
          placeholder="Write about this in your own words…"
          onChange={(e) => setNote(e.target.value)}
          className={`${field} mt-1 resize-y leading-relaxed`}
        />
      </label>

      <div className="mt-3">
        <p className="text-ink-soft font-mono text-[12px] tracking-[0.18em] uppercase">
          links
        </p>
        <div className="mt-1 flex flex-col gap-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={l.label}
                placeholder="name"
                maxLength={60}
                onChange={(e) =>
                  setLinks(
                    links.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
                className={`${field} w-[38%]`}
              />
              <input
                value={l.href}
                placeholder="/notes or https://…"
                maxLength={300}
                onChange={(e) =>
                  setLinks(
                    links.map((x, j) =>
                      j === i ? { ...x, href: e.target.value } : x,
                    ),
                  )
                }
                className={field}
              />
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => setLinks(links.filter((_, j) => j !== i))}
                className="text-ink-soft hover:text-ink px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {links.length < 8 && (
          <button
            type="button"
            onClick={() => setLinks([...links, { label: "", href: "" }])}
            className={`${button} mt-2`}
          >
            + add link
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() =>
            run(() =>
              patchNode(node.id, {
                label,
                note,
                // Half-filled rows are dropped rather than rejected.
                links: links.filter((l) => l.label.trim() && l.href.trim()),
              }),
            )
          }
          className={`${button} bg-bg-2`}
        >
          {busy ? "saving…" : "save"}
        </button>
        {node.pinned && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => patchNode(node.id, { pinned: null }))}
            className={button}
          >
            unpin
          </button>
        )}
      </div>

      {connectedTo}
      {others.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          <select
            value={joinTo}
            onChange={(e) => setJoinTo(e.target.value)}
            className={field}
            aria-label="Connect to another node"
          >
            <option value="">connect to…</option>
            {others.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !joinTo}
            onClick={() =>
              run(async () => {
                await connect(node.id, joinTo);
                setJoinTo("");
              })
            }
            className={button}
          >
            connect
          </button>
        </div>
      )}

      <form
        className="mt-5 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const name = childLabel.trim();
          if (!name) return;
          run(async () => {
            const child = await addNode(name, node.id);
            setChildLabel("");
            onSelect(child.id);
          });
        }}
      >
        <input
          value={childLabel}
          maxLength={40}
          placeholder="new node hanging off this one…"
          onChange={(e) => setChildLabel(e.target.value)}
          className={field}
        />
        <button
          type="submit"
          disabled={busy || !childLabel.trim()}
          className={button}
        >
          add
        </button>
      </form>

      {node.kind !== "core" && (
        <div className="mt-5">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-[14px]">
              <span className="text-ink-soft">Delete “{node.label}”?</span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await deleteNode(node.id);
                    onSelect(null);
                  })
                }
                className={`${button} border-accent-2 text-accent-2`}
              >
                yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={button}
              >
                keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-ink-soft hover:text-accent-2 font-mono text-[13px]"
            >
              delete this node
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-accent-2 mt-3 text-[14px]">
          {error}
        </p>
      )}
    </>
  );
}
