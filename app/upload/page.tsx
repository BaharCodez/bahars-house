"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBookToIDB } from "../../lib/indexeddb";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".epub")) {
      setError("Please choose an .epub file.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      await saveBookToIDB("current-book", new Blob([await file.arrayBuffer()], { type: file.type }));
      router.push("/read");
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string | null;
        if (!result) return;
        const base64 = result.split(",")[1] ?? "";
        try {
          localStorage.setItem("book", base64);
          router.push("/read");
        } catch {
          setLoading(false);
          setError("File too large for this browser. Try a smaller EPUB.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black p-8">
      <div className="w-full max-w-md flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-black dark:text-white">Upload a Book</h1>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files[0]);
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            dragging
              ? "border-black bg-zinc-100 dark:border-white dark:bg-zinc-900"
              : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-400"
          }`}
        >
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            {file ? (
              <span className="font-medium text-black dark:text-white">{file.name}</span>
            ) : (
              <>Drag your EPUB here or <span className="underline">click to browse</span></>
            )}
          </p>
        </div>

        {/* hidden input — no accept filter so Windows doesn't grey files out */}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          disabled={!file || loading}
          onClick={handleUpload}
          className="rounded-full bg-black text-white dark:bg-white dark:text-black px-8 py-3 font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Opening…" : "Read Book"}
        </button>
      </div>
    </div>
  );
}
