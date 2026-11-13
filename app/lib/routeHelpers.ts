import "server-only";
import { NextResponse } from "next/server";
import type * as z from "zod";

// A missing or malformed JSON body reads as null, so the schema rejects it
// with its own message instead of the handler throwing a 500.
export function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}

export function emptyResponse(status: number): NextResponse {
  return new NextResponse(null, { status });
}

export function validationError(
  error: z.ZodError,
  fallbackMessage: string,
): NextResponse {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? fallbackMessage },
    { status: 400 },
  );
}
