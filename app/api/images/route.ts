import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireOwner } from "@/app/lib/session";

// Kept under serverless request-body limits.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Upload an image for a post (multipart form: file). Returns its URL.
export async function POST(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || !file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "That's not an image." },
      { status: 400 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Images need to be under 4MB." },
      { status: 400 },
    );
  }

  const image = await prisma.image.create({
    data: { mime: file.type, data: Buffer.from(await file.arrayBuffer()) },
    select: { id: true },
  });
  return NextResponse.json(
    { id: image.id, url: `/api/images/${image.id}` },
    { status: 201 },
  );
}
