import Image from "@tiptap/extension-image";

/* The stock Image extension doesn't speak markdown; teach it ![alt](src) so
   posts keep round-tripping through the database as plain markdown. */
export const MarkdownImage = Image.extend({
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

export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_HINT.test(text);
}
