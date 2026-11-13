import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { emptyResponse } from "@/app/lib/routeHelpers";

// Serve a post image. Public — posts embedding them are public too.
export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/images/[id]">,
) {
  const { id } = await params;
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) return emptyResponse(404);

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
