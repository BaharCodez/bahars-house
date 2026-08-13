import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";
import { articleInputSchema } from "@/app/lib/validation";
import { ArticleError, articleFromText, fetchArticle } from "@/app/lib/article";

// Pull a shelved article's body into the house — fetched from the source, or
// pasted in when the site won't hand it over. Owner-only: this caches someone
// else's writing, and the reader that shows it is hers alone.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = articleInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const bookmark = await prisma.bookmark.findUnique({ where: { id } });
  if (!bookmark) return new NextResponse(null, { status: 404 });

  try {
    const article =
      parsed.data.mode === "paste"
        ? articleFromText(parsed.data.text)
        : await fetchArticle(bookmark.url);

    const updated = await prisma.bookmark.update({
      where: { id },
      data: {
        blocks: article.blocks,
        byline: article.byline,
        wordCount: article.wordCount,
        fetchedAt: new Date(),
      },
      select: { id: true, blocks: true, byline: true, wordCount: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ArticleError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
