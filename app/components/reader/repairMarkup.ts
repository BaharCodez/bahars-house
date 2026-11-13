import type { Book } from "epubjs";

type ResponseHandler = (response: unknown, type?: string) => unknown;

const HTML_TYPES = new Set(["html", "htm", "xhtml"]);
const SELF_CLOSED_RAW_TEXT_TAG = /<(script|style|title|textarea)(\b[^>]*?)\/>/gi;

// Some EPUBs ship XHTML content under a `.html` extension with self-closing
// raw-text tags (e.g. `<script src=".."/>`). That's valid XHTML, but epub.js
// parses `.html` sections as text/html, where a self-closed <script> is
// treated as *unclosed* and swallows the rest of the document as script text —
// so every chapter renders blank (only the cover, which has no such tag,
// shows). A Kiss Before Dying is one such book. Repair the raw markup just
// before epub.js parses it by wrapping the archive's response handler: close
// self-closing script/style/title/textarea tags (harmless on already-valid
// books).
export function closeSelfClosedRawTextTags(book: Book) {
  const archive = (
    book as unknown as { archive?: { handleResponse: ResponseHandler } }
  ).archive;
  if (!archive || typeof archive.handleResponse !== "function") return;

  const original = archive.handleResponse.bind(archive);
  archive.handleResponse = (response: unknown, type?: string) => {
    const isHtml = typeof response === "string" && HTML_TYPES.has(type ?? "");
    const repaired = isHtml
      ? response.replace(SELF_CLOSED_RAW_TEXT_TAG, "<$1$2></$1>")
      : response;
    return original(repaired, type);
  };
}
