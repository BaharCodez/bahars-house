import { useEffect, useState } from "react";
import { fetchAnnotations } from "@/app/lib/api";
import type { Annotation } from "@/app/lib/types";

// How often we poll for notes other readers have added.
const POLL_MS = 5000;

// The book's notes, loaded once the book is ready and then polled so friends'
// notes show up live.
export function useAnnotations(bookId: string, ready: boolean) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    if (!ready) return;
    let active = true;

    const load = () =>
      fetchAnnotations(bookId)
        .then((list) => {
          if (active) setAnnotations(list);
        })
        .catch(() => {});

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ready, bookId]);

  return [annotations, setAnnotations] as const;
}
