// Client-side EPUB metadata extraction, used before uploading a book so the
// library grid has a title/author/cover to show.

export async function parseBookMetadata(data: ArrayBuffer): Promise<{
  title: string;
  author: string;
  coverDataUrl?: string;
}> {
  const zipMetadata = await parseZipMetadata(data);
  const ePub = (await import("epubjs")).default;
  // epub.js consumes the buffer, so hand it a copy and keep the original.
  const book = ePub(data.slice(0));
  try {
    await book.ready;
    const meta = await book.loaded.metadata;
    let coverDataUrl: string | undefined = zipMetadata.coverDataUrl;
    try {
      const url = await book.coverUrl();
      if (url) {
        const blob = await fetch(url).then((r) => r.blob());
        coverDataUrl = await blobToDataUrl(blob);
      }
    } catch {
      /* no cover — fine */
    }
    return {
      title: meta?.title?.trim() || zipMetadata.title || "Untitled",
      author: meta?.creator?.trim() || zipMetadata.author || "Unknown author",
      coverDataUrl,
    };
  } finally {
    book.destroy();
  }

  async function parseZipMetadata(data: ArrayBuffer): Promise<{
    title?: string;
    author?: string;
    coverDataUrl?: string;
  }> {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(data);
      const container = await zip.file("META-INF/container.xml")?.async("text");
      if (!container) return {};

      const containerXml = new DOMParser().parseFromString(
        container,
        "application/xml",
      );
      const rootfile = containerXml
        .querySelector("rootfile")
        ?.getAttribute("full-path");
      if (!rootfile) return {};

      const opf = await zip.file(rootfile)?.async("text");
      if (!opf) return {};
      const opfXml = new DOMParser().parseFromString(opf, "application/xml");
      const text = (selector: string) =>
        opfXml.querySelector(selector)?.textContent?.trim() || undefined;
      const title = text("title, dc\\:title");
      const author = text("creator, dc\\:creator");
      const coverId =
        opfXml.querySelector('meta[name="cover"]')?.getAttribute("content") ??
        opfXml
          .querySelector("metadata meta[property='cover-image']")
          ?.getAttribute("content");
      const coverItem = coverId
        ? opfXml.querySelector(`manifest item#${CSS.escape(coverId)}`)
        : opfXml.querySelector('manifest item[properties~="cover-image"]');
      const href = coverItem?.getAttribute("href");
      if (!href) return { title, author };

      const opfDir = rootfile.includes("/")
        ? rootfile.slice(0, rootfile.lastIndexOf("/") + 1)
        : "";
      const coverPath = decodeURIComponent(
        new URL(href, `https://epub.local/${opfDir}`).pathname.slice(1),
      );
      const coverBlob = await zip.file(coverPath)?.async("blob");
      return {
        title,
        author,
        coverDataUrl: coverBlob ? await blobToDataUrl(coverBlob) : undefined,
      };
    } catch {
      return {};
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
