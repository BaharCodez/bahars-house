"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import TagInput from "./TagInput";
import CoverPicker from "./CoverPicker";

interface PostDraft {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  coverImage: string | null;
  published: boolean;
}

/* The stock Image extension doesn't speak markdown; teach it ![alt](src) so
   posts keep round-tripping through the database as plain markdown. */
const MarkdownImage = Image.extend({
  markdownTokenName: "image",
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      "image",
      {
        src: token.href,
        alt: token.text || null,
        title: token.title || null,
      },
      [],
    ),
  renderMarkdown: (node) => {
    const src = node.attrs?.src ?? "";
    const alt = node.attrs?.alt ?? "";
    const title = node.attrs?.title;
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },
}).configure({ inline: true });

const MARKDOWN_HINT =
  /^\s*(\|.*\||#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\)/m;

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
  const [title, setTitle] = useState(initial?.title ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [coverImage, setCoverImage] = useState<string | null>(
    initial?.coverImage ?? null,
  );
  const [postId, setPostId] = useState(initial?.id);
  const [published, setPublished] = useState(initial?.published ?? false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMd, setShowMd] = useState(false);
  const [mdText, setMdText] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);

  /* Latest-value refs so debounced saves never read stale state. */
  const titleRef = useRef(title);
  const tagsRef = useRef(tags);
  const coverRef = useRef(coverImage);
  const idRef = useRef(postId);
  const publishedRef = useRef(published);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const mdRef = useRef<string | null>(null);
  useEffect(() => {
    titleRef.current = title;
    tagsRef.current = tags;
    coverRef.current = coverImage;
    idRef.current = postId;
    publishedRef.current = published;
  }, [title, tags, coverImage, postId, published]);

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
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          const ed = editorRef.current;
          const rawMarkdown =
            !event.clipboardData?.getData("text/html") &&
            MARKDOWN_HINT.test(text) &&
            !ed?.isActive("codeBlock");
          if (!rawMarkdown || !ed) return false;
          event.preventDefault();
          ed.commands.insertContent(text, { contentType: "markdown" });
          return true;
        }
        const file = imageFile(event.clipboardData);
        if (!file) return false;
        event.preventDefault();
        void addImage(file);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const file = imageFile(event.dataTransfer);
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
    onUpdate: () => schedule(),
  });
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            h2: ed.isActive("heading", { level: 2 }),
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            code: ed.isActive("code"),
            codeBlock: ed.isActive("codeBlock"),
            quote: ed.isActive("blockquote"),
            list: ed.isActive("bulletList"),
            link: ed.isActive("link"),
            table: ed.isActive("table"),
          }
        : null,
  });

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  /* Autosave: settle for a moment, then persist. Saves are queued so a slow
     first POST can't race a second one into creating a duplicate post. */
  function schedule() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(), 1200);
  }

  function persist(publish?: boolean): Promise<string | null> {
    const job = queueRef.current.then(() => doSave(publish));
    queueRef.current = job.catch(() => undefined);
    return job;
  }

  async function doSave(publish?: boolean): Promise<string | null> {
    const t = titleRef.current.trim();
    const ed = editorRef.current;
    if (!t || !ed) return null; // nothing to save yet — needs a title
    syncFromMd();
    setStatus("saving");
    try {
      const res = await fetch(
        idRef.current ? `/api/posts/${idRef.current}` : "/api/posts",
        {
          method: idRef.current ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t,
            content: ed.getMarkdown(),
            tags: tagsRef.current,
            coverImage: coverRef.current,
            published: publish ?? publishedRef.current,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't save.");
        setStatus("error");
        return null;
      }
      const data = (await res.json()) as { id?: string };
      if (!idRef.current && data.id) {
        idRef.current = data.id;
        setPostId(data.id);
        // Reloading mid-write should resume this draft, not start another.
        window.history.replaceState(null, "", `/notes/write?id=${data.id}`);
      }
      if (publish !== undefined) {
        publishedRef.current = publish;
        setPublished(publish);
      }
      setError(null);
      setStatus("saved");
      return idRef.current ?? null;
    } catch {
      setStatus("error");
      return null;
    }
  }

  /* Explicit publish / unpublish, then leave the writing room. */
  async function saveAndGo(publish: boolean) {
    if (!titleRef.current.trim()) {
      setError("Give it a title first.");
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setBusy(true);
    try {
      const id = await persist(publish);
      if (!id) return;
      router.push(publish ? `/notes/${id}` : "/notes");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Tear this page out for good?")) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (idRef.current) {
      await fetch(`/api/posts/${idRef.current}`, { method: "DELETE" });
    }
    router.push("/notes");
    router.refresh();
  }

  /* Pasted or dropped images upload like the + image button. Copied images
     (as opposed to copied files) only show up in .items, not .files. */
  function imageFile(dt: DataTransfer | null) {
    if (!dt) return null;
    return (
      Array.from(dt.items)
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .find(Boolean) ??
      Array.from(dt.files).find((f) => f.type.startsWith("image/")) ??
      null
    );
  }

  async function addImage(file: File, pos?: number) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/images", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't upload that image.");
        return;
      }
      const { url } = (await res.json()) as { url: string };
      const ed = editorRef.current;
      if (!ed) return;
      const image = { type: "image", attrs: { src: url } };
      if (pos != null) {
        ed.chain().focus().insertContentAt(pos, image).run();
      } else {
        ed.chain().focus().insertContent(image).run();
      }
    } catch {
      setError("Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  function setLink() {
    const ed = editorRef.current;
    if (!ed) return;
    const prev = ed.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link to…", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") {
      ed.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    ed.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }

  /* The raw-markdown escape hatch. The editor stays mounted (just hidden) and
     is synced from the textarea before each save and when switching back. */
  function syncFromMd() {
    if (mdRef.current === null) return;
    editorRef.current?.commands.setContent(mdRef.current, {
      contentType: "markdown",
      emitUpdate: false,
    });
    mdRef.current = null;
  }

  function toggleMd() {
    const ed = editorRef.current;
    if (!ed) return;
    if (showMd) syncFromMd();
    else setMdText(ed.getMarkdown());
    setShowMd((s) => !s);
  }

  function onMdChange(value: string) {
    setMdText(value);
    mdRef.current = value;
    schedule();
  }

  const tool =
    "border-line text-ink-soft hover:text-ink hover:border-accent rounded border-2 px-2 py-0.5 font-mono text-xs transition-colors disabled:pointer-events-none disabled:opacity-30";
  const on = " text-accent border-accent";

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
          onClick={() => saveAndGo(false)}
          className="border-line text-ink-soft hover:text-ink font-pixel rounded-full border-2 px-3 py-1 text-xs"
        >
          save draft
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => saveAndGo(true)}
          className="bg-accent text-accent-ink font-pixel rounded-full px-4 py-1 text-xs hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "saving…" : "publish"}
        </button>
      </header>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          schedule();
        }}
        placeholder="Title…"
        autoFocus={!initial}
        className="text-ink placeholder:text-ink-soft/50 w-full bg-transparent font-serif text-4xl font-bold tracking-tight outline-none"
      />

      {/* topics */}
      <div className="mt-3">
        <TagInput
          value={tags}
          suggestions={allTags}
          onChange={(next) => {
            setTags(next);
            schedule();
          }}
        />
      </div>

      {/* cover image */}
      <CoverPicker
        value={coverImage}
        onChange={(url) => {
          setCoverImage(url);
          schedule();
        }}
      />

      {/* toolbar */}
      <div
        className="border-line sticky top-11 z-10 mt-4 flex flex-wrap items-center gap-2 border-y-2 py-2"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <button
          type="button"
          disabled={showMd}
          className={tool + (active?.h2 ? on : "")}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </button>
        <button
          type="button"
          disabled={showMd}
          className={`${tool} font-bold` + (active?.bold ? on : "")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          type="button"
          disabled={showMd}
          className={`${tool} italic` + (active?.italic ? on : "")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          type="button"
          disabled={showMd}
          className={tool + (active?.code ? on : "")}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          `x`
        </button>
        <button
          type="button"
          disabled={showMd}
          className={tool + (active?.codeBlock ? on : "")}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          code box
        </button>
        <button
          type="button"
          disabled={showMd}
          className={tool + (active?.quote ? on : "")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          &quot;
        </button>
        <button
          type="button"
          disabled={showMd}
          className={tool + (active?.list ? on : "")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          list
        </button>
        <button
          type="button"
          disabled={showMd}
          className={tool + (active?.link ? on : "")}
          onClick={setLink}
        >
          link
        </button>
        <button
          type="button"
          disabled={showMd}
          className={tool}
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          ⁂
        </button>
        <button
          type="button"
          disabled={showMd}
          className={tool}
          onClick={() => imageRef.current?.click()}
        >
          + image
        </button>
        <button
          type="button"
          disabled={showMd}
          className={tool + (active?.table ? on : "")}
          onClick={() =>
            editor
              ?.chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          table
        </button>
        {active?.table && !showMd && (
          <>
            <button
              type="button"
              className={tool}
              onClick={() => editor?.chain().focus().addRowAfter().run()}
            >
              + row
            </button>
            <button
              type="button"
              className={tool}
              onClick={() => editor?.chain().focus().addColumnAfter().run()}
            >
              + col
            </button>
            <button
              type="button"
              className={tool}
              onClick={() => editor?.chain().focus().deleteRow().run()}
            >
              − row
            </button>
            <button
              type="button"
              className={tool}
              onClick={() => editor?.chain().focus().deleteColumn().run()}
            >
              − col
            </button>
            <button
              type="button"
              className={`${tool} hover:text-red-500`}
              onClick={() => editor?.chain().focus().deleteTable().run()}
            >
              × table
            </button>
          </>
        )}
        <span
          className={`ml-auto font-mono text-xs ${status === "error" ? "text-red-500" : "text-ink-soft"}`}
        >
          {status === "saving" && "saving…"}
          {status === "saved" && "saved ✓"}
          {status === "error" && "not saved!"}
        </span>
        <button
          type="button"
          onClick={toggleMd}
          className={tool + (showMd ? on : "")}
        >
          {showMd ? "✎ rich" : "{} md"}
        </button>
      </div>

      <div className={showMd ? "hidden" : undefined}>
        <EditorContent editor={editor} />
      </div>
      {showMd && (
        <textarea
          value={mdText}
          onChange={(e) => onMdChange(e.target.value)}
          className="text-ink min-h-[50vh] w-full resize-y bg-transparent py-4 font-mono text-sm leading-relaxed outline-none"
        />
      )}

      {uploading && (
        <p className="text-ink-soft font-mono text-xs">uploading image…</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border-line flex items-center gap-3 border-t-2 pt-4">
        {(initial || postId) && (
          <button
            type="button"
            onClick={remove}
            className="text-ink-soft ml-auto text-sm hover:text-red-500"
          >
            tear it out
          </button>
        )}
      </div>

      <input
        ref={imageRef}
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
