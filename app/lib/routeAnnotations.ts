import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";

export const ANNOTATION_FIELDS = {
  id: true,
  cfiRange: true,
  text: true,
  comment: true,
  kind: true,
  createdAt: true,
  userId: true,
  user: { select: { name: true, image: true } },
} as const satisfies Prisma.AnnotationSelect;

type AnnotationRow = Prisma.AnnotationGetPayload<{
  select: typeof ANNOTATION_FIELDS;
}>;

export function toAnnotationJson(annotation: AnnotationRow, mine: boolean) {
  return {
    id: annotation.id,
    cfiRange: annotation.cfiRange,
    text: annotation.text,
    comment: annotation.comment,
    kind: annotation.kind,
    createdAt: annotation.createdAt.getTime(),
    authorId: annotation.userId,
    authorName: annotation.user.name ?? "Anonymous",
    authorImage: annotation.user.image,
    mine,
  };
}
