"use client";

import type { ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { SaveStatus } from "./usePostAutosave";

const TOOL =
  "border-line text-ink-soft hover:text-ink hover:border-accent rounded border-2 px-2 py-0.5 font-mono text-xs transition-colors disabled:pointer-events-none disabled:opacity-30";
const TOOL_ACTIVE = " text-accent border-accent";

type ActiveMark =
  | "h2"
  | "bold"
  | "italic"
  | "code"
  | "codeBlock"
  | "quote"
  | "list"
  | "link"
  | "table";

const FORMAT_TOOLS: {
  label: ReactNode;
  mark: ActiveMark;
  extraClass?: string;
  run: (editor: Editor) => void;
}[] = [
  {
    label: "H2",
    mark: "h2",
    run: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "B",
    mark: "bold",
    extraClass: "font-bold",
    run: (ed) => ed.chain().focus().toggleBold().run(),
  },
  {
    label: "I",
    mark: "italic",
    extraClass: "italic",
    run: (ed) => ed.chain().focus().toggleItalic().run(),
  },
  {
    label: "`x`",
    mark: "code",
    run: (ed) => ed.chain().focus().toggleCode().run(),
  },
  {
    label: "code box",
    mark: "codeBlock",
    run: (ed) => ed.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: <>&quot;</>,
    mark: "quote",
    run: (ed) => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    label: "list",
    mark: "list",
    run: (ed) => ed.chain().focus().toggleBulletList().run(),
  },
];

const TABLE_TOOLS: {
  label: string;
  extraClass?: string;
  run: (editor: Editor) => void;
}[] = [
  { label: "+ row", run: (ed) => ed.chain().focus().addRowAfter().run() },
  { label: "+ col", run: (ed) => ed.chain().focus().addColumnAfter().run() },
  { label: "− row", run: (ed) => ed.chain().focus().deleteRow().run() },
  { label: "− col", run: (ed) => ed.chain().focus().deleteColumn().run() },
  {
    label: "× table",
    extraClass: "hover:text-red-500",
    run: (ed) => ed.chain().focus().deleteTable().run(),
  },
];

/* The sticky formatting bar above the article. Formatting is disabled while
   the raw-markdown view is showing. */
export default function EditorToolbar({
  editor,
  showMarkdown,
  status,
  onPickImage,
  onToggleMarkdown,
}: {
  editor: Editor | null;
  showMarkdown: boolean;
  status: SaveStatus;
  onPickImage: () => void;
  onToggleMarkdown: () => void;
}) {
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
  const runOnEditor = (run: (ed: Editor) => void) => () => {
    if (editor) run(editor);
  };

  return (
    <div
      className="border-line sticky top-11 z-10 mt-4 flex flex-wrap items-center gap-2 border-y-2 py-2"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {FORMAT_TOOLS.map((tool) => (
        <ToolButton
          key={tool.mark}
          disabled={showMarkdown}
          active={active?.[tool.mark]}
          extraClass={tool.extraClass}
          onClick={runOnEditor(tool.run)}
        >
          {tool.label}
        </ToolButton>
      ))}
      <ToolButton
        disabled={showMarkdown}
        active={active?.link}
        onClick={runOnEditor(promptForLink)}
      >
        link
      </ToolButton>
      <ToolButton
        disabled={showMarkdown}
        onClick={runOnEditor((ed) =>
          ed.chain().focus().setHorizontalRule().run(),
        )}
      >
        ⁂
      </ToolButton>
      <ToolButton disabled={showMarkdown} onClick={onPickImage}>
        + image
      </ToolButton>
      <ToolButton
        disabled={showMarkdown}
        active={active?.table}
        onClick={runOnEditor((ed) =>
          ed
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
        )}
      >
        table
      </ToolButton>
      {active?.table &&
        !showMarkdown &&
        TABLE_TOOLS.map((tool) => (
          <ToolButton
            key={tool.label}
            extraClass={tool.extraClass}
            onClick={runOnEditor(tool.run)}
          >
            {tool.label}
          </ToolButton>
        ))}
      <SaveStatusLabel status={status} />
      <ToolButton active={showMarkdown} onClick={onToggleMarkdown}>
        {showMarkdown ? "✎ rich" : "{} md"}
      </ToolButton>
    </div>
  );
}

function ToolButton({
  active = false,
  extraClass,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  extraClass?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const base = extraClass ? `${TOOL} ${extraClass}` : TOOL;
  return (
    <button
      type="button"
      disabled={disabled}
      className={base + (active ? TOOL_ACTIVE : "")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  return (
    <span
      className={`ml-auto font-mono text-xs ${status === "error" ? "text-red-500" : "text-ink-soft"}`}
    >
      {status === "saving" && "saving…"}
      {status === "saved" && "saved ✓"}
      {status === "error" && "not saved!"}
    </span>
  );
}

function promptForLink(editor: Editor) {
  const previous = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link to…", previous ?? "https://");
  if (url === null) return;
  const href = url.trim();
  if (!href || href === "https://") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}
