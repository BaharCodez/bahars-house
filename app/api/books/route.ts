import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { actorUserId, requireOwner } from "@/app/lib/session";
import { emptyResponse } from "@/app/lib/routeHelpers";

// One shared library, no sign-in needed: anonymous visitors act as the
// site owner, so `mine` lights up their books and the delete buttons.
export async function GET() {
  const userId = await actorUserId();

  const books = await prisma.book.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      author: true,
      coverDataUrl: true,
      createdAt: true,
      ownerId: true,
      owner: { select: { name: true } },
      _count: { select: { annotations: true } },
    },
  });

  return NextResponse.json(
    books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      coverDataUrl: b.coverDataUrl,
      createdAt: b.createdAt.getTime(),
      noteCount: b._count.annotations,
      ownerName: b.owner.name ?? "Someone",
      mine: b.ownerId === userId,
    })),
  );
}

// Upload a new EPUB (multipart form: file, title, author, coverDataUrl).
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const userId = await actorUserId();
  if (!userId) return emptyResponse(401);

  const form = await req.formData();
  const file = form.get("file");
  const title = trimmedField(form, "title") || "Untitled";
  const author = trimmedField(form, "author") || "Unknown author";
  const coverDataUrl = form.get("coverDataUrl");

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  const book = await prisma.book.create({
    data: {
      title,
      author,
      coverDataUrl: typeof coverDataUrl === "string" ? coverDataUrl : null,
      data: Buffer.from(await file.arrayBuffer()),
      ownerId: userId,
    },
    select: { id: true, title: true, author: true, coverDataUrl: true },
  });

  return NextResponse.json(book, { status: 201 });
}

function trimmedField(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}
