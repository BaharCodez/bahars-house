import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import PostEditor from "@/app/components/PostEditor";
import { postTagCounts } from "@/app/lib/tags";

export const metadata: Metadata = {
  title: "writing desk — bahar's house",
};

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const [post, tagCounts] = await Promise.all([
    id
      ? prisma.post.findUnique({
          where: { id },
          select: {
            id: true,
            title: true,
            content: true,
            tags: true,
            coverImage: true,
            publishedAt: true,
          },
        })
      : null,
    postTagCounts(),
  ]);
  if (id && !post) notFound();

  return (
    <main className="flex flex-1 flex-col">
      <PostEditor
        allTags={tagCounts.map((t) => t.tag)}
        initial={
          post
            ? {
                id: post.id,
                title: post.title,
                content: post.content,
                tags: post.tags,
                coverImage: post.coverImage,
                published: !!post.publishedAt,
              }
            : undefined
        }
      />
    </main>
  );
}
