"use client";

import { useEffect, useRef, useState } from "react";
import { getBookFromIDB } from "../../lib/indexeddb";

export default function ReadPage() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let blobUrl: string | null = null;

    (async () => {
      let arrayBuffer: ArrayBuffer | null = null;

      try {
        arrayBuffer = await getBookFromIDB("current-book");
      } catch (err) {
        console.error("IDB read failed", err);
      }

      if (!arrayBuffer) {
        try {
          const data = localStorage.getItem("book");
          if (!data) throw new Error("No book found. Go back and upload an EPUB first.");
          arrayBuffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
        } catch (err: any) {
          setError(err?.message ?? "No book data available");
          setLoading(false);
          return;
        }
      }

      try {
        const { default: ePub } = await import("epubjs");

        const blob = new Blob([arrayBuffer], { type: "application/epub+zip" });
        blobUrl = URL.createObjectURL(blob);

        const book = (ePub as any)(blobUrl);
        const rendition = book.renderTo(viewerRef.current!, {
          width: "100%",
          height: window.innerHeight,
        });

        await rendition.display();
        setLoading(false);
      } catch (err: any) {
        console.error("EPUB rendering failed", err);
        setError(err?.message ?? String(err));
        setLoading(false);
      }
    })();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  return (
    <div style={{ height: "100vh" }}>
      {loading && !error && (
        <div className="flex h-screen items-center justify-center text-zinc-500">
          Loading book…
        </div>
      )}
      {error && (
        <div className="flex h-screen items-center justify-center p-8">
          <p className="text-red-500 text-center">{error}</p>
        </div>
      )}
      <div
        ref={viewerRef}
        style={{ height: "100vh", display: loading || error ? "none" : "block" }}
      />
    </div>
  );
}
