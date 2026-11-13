// EPUBs converted from PDFs often split the book into one tiny file per PDF
// page. epub.js starts every file on a fresh screen, so at smaller text sizes
// each "page" fills only part of the screen and the rest is left blank.
//
// Before epub.js sees the book, join runs of those tiny files into
// chapter-sized ones: a new chapter starts wherever the table of contents
// points, or once a chunk gets long. Only books that look page-split are
// touched — the rule must stay stable, since saved positions and notes are
// CFIs into the merged layout.

const MIN_SECTIONS = 100;
const MAX_MEDIAN_CHARS = 5000;
const MAX_CHUNK_CHARS = 60000;
const XHTML_NS = "http://www.w3.org/1999/xhtml";

export interface MergedBook {
  bytes: ArrayBuffer;
  // Map an href into the original book ("page_12.html#x") to where it lives
  // now ("page_10.html#x"). Identity for books that weren't merged.
  remapHref: (href: string) => string;
}

const identity = (href: string) => href;

export async function mergePageSections(
  data: ArrayBuffer,
): Promise<MergedBook> {
  try {
    return (await merge(data)) ?? { bytes: data, remapHref: identity };
  } catch (e) {
    console.warn("Couldn't merge page sections; opening as-is.", e);
    return { bytes: data, remapHref: identity };
  }
}

async function merge(data: ArrayBuffer): Promise<MergedBook | null> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data.slice(0));

  const container = await zip.file("META-INF/container.xml")?.async("text");
  if (!container) return null;
  const opfPath = parseXml(container)
    .querySelector("rootfile")
    ?.getAttribute("full-path");
  const opfText = opfPath && (await zip.file(opfPath)?.async("text"));
  if (!opfPath || !opfText) return null;
  const opf = parseXml(opfText);

  const manifest = new Map<string, Element>();
  for (const item of Array.from(opf.querySelectorAll("manifest > item"))) {
    const id = item.getAttribute("id");
    if (id) manifest.set(id, item);
  }
  const itemrefs = Array.from(opf.querySelectorAll("spine > itemref"));
  if (itemrefs.length < MIN_SECTIONS) return null;

  // Load every spine document once.
  type Section = {
    ref: Element;
    path: string;
    doc: Document | null;
    chars: number;
  };
  const sections: Section[] = [];
  for (const ref of itemrefs) {
    const item = manifest.get(ref.getAttribute("idref") ?? "");
    const href = item?.getAttribute("href");
    const isHtml = /html/.test(item?.getAttribute("media-type") ?? "");
    const path = href ? resolvePath(opfPath, href) : "";
    const text = isHtml ? await zip.file(path)?.async("text") : undefined;
    const doc = text ? parseHtml(text) : null;
    sections.push({
      ref,
      path,
      doc,
      chars: doc?.body?.textContent?.length ?? 0,
    });
  }

  const sorted = sections.map((s) => s.chars).sort((a, b) => a - b);
  if (sorted[Math.floor(sorted.length / 2)] > MAX_MEDIAN_CHARS) return null;

  // Files the table of contents points at must each start a chapter.
  const navFiles = navigationFiles(opf, manifest, opfPath);
  const tocTargets = new Set<string>();
  for (const navPath of navFiles) {
    const text = await zip.file(navPath)?.async("text");
    if (!text) continue;
    const nav = parseXml(text);
    for (const el of Array.from(nav.querySelectorAll("[href], content[src]"))) {
      const href = el.getAttribute("href") ?? el.getAttribute("src") ?? "";
      tocTargets.add(resolvePath(navPath, href.split("#")[0]));
    }
  }

  // A contents list with an entry for most files is listing pages, not
  // chapters — don't let it force a break at every page.
  if (tocTargets.size > sections.length / 2) tocTargets.clear();

  // Group consecutive sections into chunks.
  const groups: Section[][] = [];
  let chunkChars = 0;
  for (const section of sections) {
    const last = groups.at(-1);
    const head = last?.[0];
    const joinable =
      last &&
      head?.doc &&
      section.doc &&
      section.ref.getAttribute("linear") !== "no" &&
      head.ref.getAttribute("linear") !== "no" &&
      !tocTargets.has(section.path) &&
      dirOf(section.path) === dirOf(head.path) &&
      chunkChars + section.chars <= MAX_CHUNK_CHARS;
    if (joinable) {
      last.push(section);
      chunkChars += section.chars;
    } else {
      groups.push([section]);
      chunkChars = section.chars;
    }
  }
  if (groups.length === sections.length) return null;

  // Where each original file now lives, and the id marking its start.
  const moved = new Map<string, { path: string; marker: string }>();
  groups.forEach((group) =>
    group.slice(1).forEach((section, i) => {
      moved.set(section.path, {
        path: group[0].path,
        marker: `merged-page-${basename(group[0].path)}-${i + 1}`,
      });
    }),
  );

  // Rewrite a link written inside `fromPath` (relative to it).
  const rewriteLink = (fromPath: string, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return href;
    const [file, anchor] = href.split("#");
    const target = moved.get(resolvePath(fromPath, file));
    if (!target) return href;
    // Merged files share a directory, so only the file name changes.
    const newFile =
      file.slice(0, file.length - basename(file).length) +
      basename(target.path);
    return `${newFile}#${anchor || target.marker}`;
  };

  for (const group of groups) {
    const head = group[0];
    if (group.length > 1 && head.doc) {
      const doc = head.doc;
      group.slice(1).forEach((section) => {
        const src = section.doc!;
        // Carry over any stylesheets the head doesn't already have.
        for (const el of Array.from(
          src.head?.querySelectorAll("link[rel~='stylesheet'], style") ?? [],
        )) {
          const href = el.getAttribute("href");
          const dup = href
            ? doc.head?.querySelector(`link[href="${CSS.escape(href)}"]`)
            : null;
          if (!dup) doc.head?.appendChild(doc.importNode(el, true));
        }
        const wrapper = doc.createElementNS(XHTML_NS, "div");
        wrapper.setAttribute("id", moved.get(section.path)!.marker);
        for (const child of Array.from(src.body?.childNodes ?? [])) {
          wrapper.appendChild(doc.importNode(child, true));
        }
        doc.body.appendChild(wrapper);
        section.ref.remove();
      });
    }
    if (head.doc) {
      for (const a of Array.from(head.doc.querySelectorAll("a[href]"))) {
        a.setAttribute("href", rewriteLink(head.path, a.getAttribute("href")!));
      }
      zip.file(head.path, new XMLSerializer().serializeToString(head.doc));
    }
  }

  // Point the table of contents at the merged files.
  for (const navPath of navFiles) {
    const text = await zip.file(navPath)?.async("text");
    if (!text) continue;
    const nav = parseXml(text);
    for (const el of Array.from(nav.querySelectorAll("[href]"))) {
      el.setAttribute("href", rewriteLink(navPath, el.getAttribute("href")!));
    }
    for (const el of Array.from(nav.querySelectorAll("content[src]"))) {
      el.setAttribute("src", rewriteLink(navPath, el.getAttribute("src")!));
    }
    zip.file(navPath, new XMLSerializer().serializeToString(nav));
  }

  zip.file(opfPath, new XMLSerializer().serializeToString(opf));
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  // epub.js hrefs (TOC, roadmap step links) are relative to the OPF.
  return { bytes, remapHref: (href) => rewriteLink(opfPath, href) };
}

function navigationFiles(
  opf: Document,
  manifest: Map<string, Element>,
  opfPath: string,
): string[] {
  const items = [...manifest.values()].filter(
    (item) =>
      item.getAttribute("media-type") === "application/x-dtbncx+xml" ||
      /(^|\s)nav(\s|$)/.test(item.getAttribute("properties") ?? ""),
  );
  const tocId = opf.querySelector("spine")?.getAttribute("toc");
  const ncx = tocId ? manifest.get(tocId) : undefined;
  if (ncx && !items.includes(ncx)) items.push(ncx);
  return items
    .map((item) => item.getAttribute("href"))
    .filter((href): href is string => !!href)
    .map((href) => resolvePath(opfPath, href));
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function parseHtml(text: string): Document | null {
  const xml = new DOMParser().parseFromString(text, "application/xhtml+xml");
  if (!xml.querySelector("parsererror") && xml.body) return xml;
  const html = new DOMParser().parseFromString(text, "text/html");
  return html.body ? html : null;
}

function resolvePath(from: string, href: string): string {
  return decodeURIComponent(
    new URL(href, `https://epub.local/${from}`).pathname.slice(1),
  );
}

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/") + 1);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
