export const UPLOAD_FAILED = "Couldn't upload that image.";

/* Carries the server's own reason, so it can be shown to the writer as-is. */
export class ImageUploadError extends Error {}

/* Copied images (as opposed to copied files) only show up in .items, not
   .files. */
export function imageFromTransfer(
  transfer: DataTransfer | null,
): File | undefined {
  if (!transfer) return undefined;
  return (
    Array.from(transfer.items)
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .find(Boolean) ??
    Array.from(transfer.files).find((f) => f.type.startsWith("image/"))
  );
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/images", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ImageUploadError(body.error ?? UPLOAD_FAILED);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}
