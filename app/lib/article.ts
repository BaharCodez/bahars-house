import "server-only";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/**
 * Pulling an article into the house so it can be read — and marked up — here
 * rather than in a tab somewhere else.
 *
 * The body is reduced to plain-text blocks on purpose: highlights anchor to
 * (block, start, end) offsets, which only stay honest if the text is a flat
 * string, and rendering someone else's markup would mean trusting it. Bold
 * and inline links are the price; being able to say "I didn't get this
 * sentence" is what we're buying.
 */

export type Block =
  | { t: "p" | "h2" | "h3" | "li" | "quote" | "code"; s: string }
  | { t: "img"; src: string; alt: string };

export interface Article {
  blocks: Block[];
  byline: string;
  wordCount: number;
}

// Guard rails for the fetch: a stuck server shouldn't hang a page render, and
// a 40MB "article" isn't one.
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 4_000_000;
const MAX_BLOCKS = 1500;
const MAX_BLOCK_CHARS = 20_000;

// Sites hand plain crawlers a stub or a 403; ask like a browser would.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Thrown when a URL can't be turned into something readable. */
export class ArticleError extends Error {}

// Loopback and LAN addresses — the fetch is owner-only, but "read this URL"
// should still never be a way to knock on the machine's own doors.
function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd")) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = v4.slice(1).map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

type TextBlock = Extract<Block, { s: string }>;

const BLOCK_TAGS: Record<string, TextBlock["t"]> = {
  P: "p",
  H1: "h2",
  H2: "h2",
  H3: "h3",
  H4: "h3",
  H5: "h3",
  H6: "h3",
  LI: "li",
  BLOCKQUOTE: "quote",
  PRE: "code",
  FIGCAPTION: "quote",
  DD: "p",
  DT: "h3",
  TD: "p",
  TH: "p",
};

// Chrome that survives Readability now and then, and reads as noise.
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "SVG",
  "IFRAME",
  "FORM",
  "BUTTON",
  "NAV",
  "VIDEO",
  "AUDIO",
]);

function tidy(text: string, keepBreaks: boolean) {
  const s = keepBreaks
    ? text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "")
    : text.replace(/\s+/g, " ");
  return s.trim().slice(0, MAX_BLOCK_CHARS);
}

/** Walk the cleaned-up article, flattening it into ordered text blocks. */
function toBlocks(root: Element, baseUrl: string): Block[] {
  const out: Block[] = [];

  const pushImage = (el: Element) => {
    const raw =
      el.getAttribute("src") ||
      el.getAttribute("data-src") ||
      // Lazy-loaded images: take the first candidate from the srcset.
      el.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0] ||
      "";
    if (!raw) return;
    try {
      const src = new URL(raw, baseUrl);
      // Remote http(s) only — no data: payloads inflating the row.
      if (src.protocol !== "https:" && src.protocol !== "http:") return;
      out.push({
        t: "img",
        src: src.toString(),
        alt: tidy(el.getAttribute("alt") ?? "", false).slice(0, 300),
      });
    } catch {
      /* an unparseable src is just a missing picture */
    }
  };

  const visit = (el: Element) => {
    if (out.length >= MAX_BLOCKS) return;
    const tag = el.tagName?.toUpperCase() ?? "";
    if (SKIP_TAGS.has(tag)) return;
    if (tag === "IMG") return pushImage(el);

    const kind = BLOCK_TAGS[tag];
    if (kind) {
      // A list item wrapping a nested list would double up its children's
      // text, so let the nesting win and only take this node's own prose.
      const nested = el.querySelector?.("ul, ol, blockquote, pre, table");
      if (!nested) {
        const text = tidy(el.textContent ?? "", kind === "code");
        if (text) out.push({ t: kind, s: text });
        el.querySelectorAll?.("img").forEach(pushImage);
        return;
      }
    }

    for (const child of Array.from(el.children)) visit(child as Element);
  };

  visit(root);

  // Readability leaves the odd duplicated heading; drop repeats sitting
  // directly on top of each other.
  return out.filter((b, i) => {
    const prev = out[i - 1];
    if (!prev || b.t === "img" || prev.t === "img") return true;
    return !(prev.t === b.t && prev.s === b.s);
  });
}

function countWords(blocks: Block[]) {
  let n = 0;
  for (const b of blocks) {
    if (b.t !== "img" && b.t !== "code") {
      n += b.s.split(/\s+/).filter(Boolean).length;
    }
  }
  return n;
}

/* linkedom leaves everything outside <body> when the source omits the tag —
   which plenty of hand-written blogs (and Readability's own output fragment)
   do. Wrapping and re-parsing puts it back where the walk can find it. */
function parseDocument(html: string) {
  const { document } = parseHTML(html);
  if (document.body?.textContent?.trim()) return document;
  return parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`).document;
}

/** Turn a page of HTML into readable blocks. Exported for the paste path. */
export function extractArticle(html: string, url: string): Article {
  const document = parseDocument(html);
  let byline = "";
  let root: Element | null = null;

  try {
    const parsed = new Readability(document as unknown as Document, {
      charThreshold: 200,
    }).parse();
    if (parsed?.content) {
      byline = tidy(parsed.byline ?? "", false).slice(0, 200);
      root = parseDocument(parsed.content).body as unknown as Element;
    }
  } catch {
    /* fall through to the whole-page reading below */
  }

  // Readability gives up on short or oddly-marked-up pages — take the body as
  // it comes rather than showing nothing.
  const blocks = toBlocks(
    root ?? (document.body as unknown as Element),
    url,
  ).filter((b) => b.t === "img" || b.s.length > 1);

  if (!blocks.some((b) => b.t !== "img")) {
    throw new ArticleError(
      "There was no readable article on that page — paste the text in instead.",
    );
  }
  return { blocks, byline, wordCount: countWords(blocks) };
}

/** Pasted text: blank lines separate paragraphs, nothing else is assumed. */
export function articleFromText(text: string): Article {
  const blocks: Block[] = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => tidy(chunk, false))
    .filter(Boolean)
    .slice(0, MAX_BLOCKS)
    .map((s) => ({ t: "p" as const, s }));

  if (!blocks.length) throw new ArticleError("There was no text to save.");
  return { blocks, byline: "", wordCount: countWords(blocks) };
}

/** Fetch a URL and reduce it to readable blocks. Throws ArticleError. */
export async function fetchArticle(url: string): Promise<Article> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new ArticleError("That isn't a URL I can open.");
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new ArticleError("Only http and https links can be pulled in.");
  }
  if (isPrivateHost(target.hostname)) {
    throw new ArticleError("That address is on this machine's own network.");
  }

  let res: Response;
  try {
    res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });
  } catch {
    throw new ArticleError(
      "Couldn't reach that page — it may be slow or blocking us.",
    );
  }

  if (!res.ok) {
    throw new ArticleError(
      res.status === 403 || res.status === 401
        ? "That site won't hand the article over — paste the text in instead."
        : `That page came back ${res.status}.`,
    );
  }

  const type = res.headers.get("content-type") ?? "";
  if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
    throw new ArticleError("That link isn't a web page.");
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new ArticleError("That page is too big to pull in.");
  }
  const html = new TextDecoder("utf-8").decode(buf);

  // res.url follows redirects, so relative images resolve against where we
  // actually landed.
  return extractArticle(html, res.url || target.toString());
}

/** Roughly how long the read is, for the reader's header. */
export function readingMinutes(wordCount: number) {
  return Math.max(1, Math.round(wordCount / 220));
}
