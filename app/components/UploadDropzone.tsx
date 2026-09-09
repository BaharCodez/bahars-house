"use client";

import { useRef } from "react";
import SignedInBar from "./SignedInBar";
import { useFileDrop } from "@/app/lib/useFileDrop";

interface UploadDropzoneProps {
  busy?: boolean;
  error?: string | null;
  userName: string;
  canManageBooks: boolean;
  onFile: (file: File) => void;
}

export default function UploadDropzone({
  busy = false,
  error = null,
  userName,
  canManageBooks,
  onFile,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { dragging, dropHandlers } = useFileDrop(onFile);

  // The whole area below the top bar is a drop target, so an imprecise drop
  // still lands.
  return (
    <div
      className="flex flex-1 flex-col"
      {...(canManageBooks ? dropHandlers : {})}
    >
      <SignedInBar userName={userName} />
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-ink font-serif text-3xl font-semibold tracking-tight">
            Start your bookshelf
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            {canManageBooks
              ? "Upload an EPUB to start reading. Share it and read together."
              : "The bookshelf is ready for the keeper to add its first book."}
          </p>

          {canManageBooks && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`mt-8 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 transition-colors ${
                dragging
                  ? "border-accent bg-accent/10"
                  : "border-line hover:border-accent/60"
              }`}
            >
              <span className="text-ink text-base font-medium">
                {busy
                  ? "Adding book…"
                  : dragging
                    ? "Drop to add"
                    : "Drop an EPUB here"}
              </span>
              <span className="text-ink-soft text-sm">or click to browse</span>
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".epub,application/epub+zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-picking the same file
              if (file) onFile(file);
            }}
          />

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
