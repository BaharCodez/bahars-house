import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { signupSchema } from "@/app/lib/validation";
import { readJson, validationError } from "@/app/lib/routeHelpers";

export async function POST(req: Request) {
  // The house hands out exactly one key: signup only works on a fresh
  // database (bootstrapping the owner account), then it's closed.
  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  if (anyUser) {
    return NextResponse.json(
      { error: "This house isn't handing out new keys." },
      { status: 403 },
    );
  }

  const parsed = signupSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error, "Invalid input.");

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
