"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import TagInput from "./TagInput";
import CoverPicker from "./CoverPicker";
import EditorToolbar from "./editor/EditorToolbar";
import { MarkdownImage, looksLikeMarkdown } from "./editor/markdown";
import {
  ImageUploadError,
  UPLOAD_FAILED,
  imageFromTransfer,
  uploadImage,
} from "./editor/images";
import { usePostAutosave, type PostDraft } from "./editor/usePostAutosave";

/* A calm writing room: big title, a toolbar, and the article itself is the
   editor — what you type looks like the published page (markdown stays the
   storage format underneath). Saves itself as you write. */
export default function PostEditor({
  initial,
  allTags = [],
}: {
  initial?: PostDraft & { id: string };
  allTags?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [markdownText, setMarkdownText] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  /* Raw-markdown edits not yet pushed into the editor. */
  const pendingMarkdownRef = useRef<string | null>(null);
  const draft = usePostAutosave(initial, readEditorMarkdown);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      MarkdownImage,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({
        placeholder:
          "Write about what you're reading, building, wondering… (paste or drop images right here)",
      }),
      Markdown.configure({ markedOptions: { breaks: true } }),
    ],
    contentType: "markdown",
    content: initial?.content ?? "",
    editorProps: {
      attributes: { class: "article min-h-[50vh] w-full py-4 outline-none" },
      handlePaste: (_view, event) => handlePaste(event),
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const file = imageFromTransfer(event.dataTransfer);
        if (!file) return false;
        event.preventDefault();
        const pos = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;
        void addImage(file, pos);
        return true;
      },
    },
    onUpdate: () => draft.scheduleSave(),
  });
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  function readEditorMarkdown() {
    const ed = editorRef.current;
    if (!ed) return undefined;
    syncFromMarkdownView();
    return ed.getMarkdown();
  }

  /* Explicit publish / unpublish, then leave the writing room. */
  async function saveAndLeave(publish: boolean) {
    if (!draft.title.trim()) {
      draft.setError("Give it a title first.");
      return;
    }
    draft.cancelScheduledSave();
    setBusy(true);
    try {
      const id = await draft.persist(publish);
      if (!id) return;
      router.push(publish ? `/notes/${id}` : "/notes");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function tearOut() {
    if (!window.confirm("Tear this page out for good?")) return;
    await draft.deletePost();
    router.push("/notes");
    router.refresh();
  }

  /* Pasted markdown is rendered rather than inserted as literal text, unless
     the clipboard also carries HTML or the cursor is in a code block. */
  function handlePaste(event: ClipboardEvent): boolean {
    const text = event.clipboardData?.getData("text/plain");
    if (text) return pasteMarkdown(event, text);
    const file = imageFromTransfer(event.clipboardData);
    if (!file) return false;
    event.preventDefault();
    void addImage(file);
    return true;
  }

  function pasteMarkdown(event: ClipboardEvent, text: string): boolean {
    const ed = editorRef.current;
    const isRawMarkdown =
      !event.clipboardData?.getData("text/html") &&
      looksLikeMarkdown(text) &&
      !ed?.isActive("codeBlock");
    if (!isRawMarkdown || !ed) return false;
    event.preventDefault();
    ed.commands.insertContent(text, { contentType: "markdown" });
    return true;
  }

  /* Pasted or dropped images upload like the + image button. */
  async function addImage(file: File, pos?: number) {
    draft.setError(null);
    setUploading(true);
    try {
      insertImage(await uploadImage(file), pos);
    } catch (err) {
      draft.setError(
        err instanceof ImageUploadError ? err.message : UPLOAD_FAILED,
      );
    } finally {
      setUploading(false);
    }
  }

  function insertImage(src: string, pos?: number) {
    const ed = editorRef.current;
    if (!ed) return;
    const image = { type: "image", attrs: { src } };
    if (pos != null) {
      ed.chain().focus().insertContentAt(pos, image).run();
    } else {
      ed.chain().focus().insertContent(image).run();
    }
  }

  /* The raw-markdown escape hatch. The editor stays mounted (just hidden) and
     is synced from the textarea before each save and when switching back. */
  function syncFromMarkdownView() {
    if (pendingMarkdownRef.current === null) return;
    editorRef.current?.commands.setContent(pendingMarkdownRef.current, {
      contentType: "markdown",
      emitUpdate: false,
    });
    pendingMarkdownRef.current = null;
  }

  function toggleMarkdownView() {
    const ed = editorRef.current;
    if (!ed) return;
    if (showMarkdown) syncFromMarkdownView();
    else setMarkdownText(ed.getMarkdown());
    setShowMarkdown((s) => !s);
  }

  function editMarkdown(value: string) {
    setMarkdownText(value);
    pendingMarkdownRef.current = value;
    draft.scheduleSave();
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
      <header
        className="sticky top-0 z-20 flex h-11 items-center gap-3"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <Link
          href="/notes"
          className="font-pixel text-ink-soft hover:text-ink mr-auto text-sm transition-colors"
        >
          ← writing room
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => saveAndLeave(false)}
          className="border-line text-ink-soft hover:text-ink font-pixel rounded-full border-2 px-3 py-1 text-xs"
        >
          save draft
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => saveAndLeave(true)}
          className="bg-accent text-accent-ink font-pixel rounded-full px-4 py-1 text-xs hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "saving…" : "publish"}
        </button>
      </header>

      <input
        value={draft.title}
        onChange={(e) => {
          draft.setTitle(e.target.value);
          draft.scheduleSave();
        }}
        placeholder="Title…"
        autoFocus={!initial}
        className="text-ink placeholder:text-ink-soft/50 w-full bg-transparent font-serif text-4xl font-bold tracking-tight outline-none"
      />

      <div className="mt-3">
        <TagInput
          value={draft.tags}
          suggestions={allTags}
          onChange={(next) => {
            draft.setTags(next);
            draft.scheduleSave();
          }}
        />
      </div>

      <CoverPicker
        value={draft.coverImage}
        onChange={(url) => {
          draft.setCoverImage(url);
          draft.scheduleSave();
        }}
      />

      <EditorToolbar
        editor={editor}
        showMarkdown={showMarkdown}
        status={draft.status}
        onPickImage={() => imageInputRef.current?.click()}
        onToggleMarkdown={toggleMarkdownView}
      />

      <div className={showMarkdown ? "hidden" : undefined}>
        <EditorContent editor={editor} />
      </div>
      {showMarkdown && (
        <textarea
          value={markdownText}
          onChange={(e) => editMarkdown(e.target.value)}
          className="text-ink min-h-[50vh] w-full resize-y bg-transparent py-4 font-mono text-sm leading-relaxed outline-none"
        />
      )}

      {uploading && (
        <p className="text-ink-soft font-mono text-xs">uploading image…</p>
      )}
      {draft.error && <p className="text-sm text-red-600">{draft.error}</p>}

      <div className="border-line flex items-center gap-3 border-t-2 pt-4">
        {(initial || draft.postId) && (
          <button
            type="button"
            onClick={tearOut}
            className="text-ink-soft ml-auto text-sm hover:text-red-500"
          >
            tear it out
          </button>
        )}
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void addImage(file);
        }}
      />
    </div>
  );
}
