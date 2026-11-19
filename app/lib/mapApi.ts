// Same-origin calls to the owner-only mind-map routes. Every one of these is
// authorised on the server (requireOwner); this file only wraps the fetches.

import type { MapLink, MapNode } from "./mindMap";

async function send<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Something went wrong (${res.status}).`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const seedMap = () => send<{ ok: true }>("/api/map/seed", "POST");

export const addNode = (label: string, parentId?: string) =>
  send<MapNode>("/api/map/nodes", "POST", { label, parentId });

export const patchNode = (
  id: string,
  change: {
    label?: string;
    note?: string;
    links?: MapLink[];
    pinned?: { x: number; y: number } | null;
  },
) => send<MapNode>(`/api/map/nodes/${id}`, "PATCH", change);

export const deleteNode = (id: string) =>
  send<void>(`/api/map/nodes/${id}`, "DELETE");

export const connect = (sourceId: string, targetId: string) =>
  send<{ id: string }>("/api/map/edges", "POST", { sourceId, targetId });

export const disconnect = (edgeId: string) =>
  send<void>(`/api/map/edges/${edgeId}`, "DELETE");
