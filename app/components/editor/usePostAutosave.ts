"use client";

import { useEffect, useRef, useState } from "react";

export interface PostDraft {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  coverImage: string | null;
  published: boolean;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 1200;

/* The post's fields plus autosave: settle for a moment, then persist. Saves
   are queued so a slow first POST can't race a second one into creating a
   duplicate post. `readContent` returns the body as markdown, or undefined
   while there is no editor to read it from. */
export function usePostAutosave(
  initial: (PostDraft & { id: string }) | undefined,
  readContent: () => string | undefined,
) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [coverImage, setCoverImage] = useState<string | null>(
    initial?.coverImage ?? null,
  );
  const [postId, setPostId] = useState(initial?.id);
  const [published, setPublished] = useState(initial?.published ?? false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  /* Latest-value refs so debounced saves never read stale state. */
  const titleRef = useRef(title);
  const tagsRef = useRef(tags);
  const coverRef = useRef(coverImage);
  const idRef = useRef(postId);
  const publishedRef = useRef(published);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    titleRef.current = title;
    tagsRef.current = tags;
    coverRef.current = coverImage;
    idRef.current = postId;
    publishedRef.current = published;
  }, [title, tags, coverImage, postId, published]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function cancelScheduledSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  function scheduleSave() {
    cancelScheduledSave();
    timerRef.current = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
  }

  function persist(publish?: boolean): Promise<string | undefined> {
    const job = queueRef.current.then(() => writePost(publish));
    queueRef.current = job.catch(() => undefined);
    return job;
  }

  async function writePost(publish?: boolean): Promise<string | undefined> {
    const trimmedTitle = titleRef.current.trim();
    if (!trimmedTitle) return undefined;
    const content = readContent();
    if (content === undefined) return undefined;
    setStatus("saving");
    try {
      const res = await fetch(
        idRef.current ? `/api/posts/${idRef.current}` : "/api/posts",
        {
          method: idRef.current ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle,
            content,
            tags: tagsRef.current,
            coverImage: coverRef.current,
            published: publish ?? publishedRef.current,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save.");
        setStatus("error");
        return undefined;
      }
      const saved = (await res.json()) as { id?: string };
      if (!idRef.current && saved.id) rememberNewPost(saved.id);
      if (publish !== undefined) {
        publishedRef.current = publish;
        setPublished(publish);
      }
      setError(null);
      setStatus("saved");
      return idRef.current;
    } catch {
      setStatus("error");
      return undefined;
    }
  }

  function rememberNewPost(id: string) {
    idRef.current = id;
    setPostId(id);
    // Reloading mid-write should resume this draft, not start another.
    window.history.replaceState(null, "", `/notes/write?id=${id}`);
  }

  async function deletePost() {
    cancelScheduledSave();
    if (idRef.current) {
      await fetch(`/api/posts/${idRef.current}`, { method: "DELETE" });
    }
  }

  return {
    title,
    setTitle,
    tags,
    setTags,
    coverImage,
    setCoverImage,
    postId,
    status,
    error,
    setError,
    scheduleSave,
    cancelScheduledSave,
    persist,
    deletePost,
  };
}
