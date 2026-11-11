import "server-only";
import { randomBytes } from "crypto";
import { createSupabaseAdmin } from "./supabase/admin";

export const PHOTO_BUCKET = "reference-photos";
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Decide the image type from the file's own bytes ("magic numbers"), never from the name or the
 * Content-Type the browser declared, which an attacker controls.
 */
export function sniffImage(bytes: Buffer): { mime: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

/**
 * Uploads an image to the private bucket under a random object path and returns that path.
 * The bucket is private, so the path alone is useless; viewing requires a signed URL.
 */
export async function savePhoto(file: File): Promise<string | { error: string }> {
  if (file.size === 0) return { error: "Empty file." };
  if (file.size > MAX_BYTES) return { error: "Photo must be under 3 MB." };

  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { error: "Photo must be a real JPEG, PNG or WebP image." };

  const path = `${randomBytes(16).toString("hex")}.${kind.ext}`;
  const { error } = await createSupabaseAdmin()
    .storage.from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (error) {
    console.error("storage upload failed", error.message);
    return { error: "Upload failed. Please try again." };
  }
  return path;
}

/**
 * Short-lived URL for one photo. Callers must check the viewer may see the request first;
 * this function only mints the link.
 */
export async function signedPhotoUrl(path: string, seconds = 300): Promise<string | null> {
  const { data } = await createSupabaseAdmin().storage.from(PHOTO_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
