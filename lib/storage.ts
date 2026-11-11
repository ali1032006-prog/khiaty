import { randomBytes } from "crypto";
import { createSupabaseAdmin } from "./supabase/admin";

export const PHOTO_BUCKET = "reference-photos";
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Uploads an image to the private bucket under a random object path and returns that path.
 * The bucket is private, so the path alone is useless; viewing requires a signed URL.
 */
export async function savePhoto(file: File): Promise<string | { error: string }> {
  if (file.size === 0) return { error: "Empty file." };
  if (file.size > MAX_BYTES) return { error: "Photo must be under 3 MB." };
  const ext = ALLOWED[file.type];
  if (!ext) return { error: "Photo must be JPEG, PNG or WebP." };

  const path = `${randomBytes(16).toString("hex")}.${ext}`;
  const { error } = await createSupabaseAdmin()
    .storage.from(PHOTO_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return { error: "Upload failed: " + error.message };
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
