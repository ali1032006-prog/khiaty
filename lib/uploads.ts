import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Saves an uploaded image under a random filename and returns that filename.
 * We never trust the browser's filename or extension: the type comes from the MIME header
 * (the audit phase may have opinions about trusting that too) and the name is random.
 */
export async function saveImage(file: File): Promise<string | { error: string }> {
  if (file.size === 0) return { error: "Empty file." };
  if (file.size > MAX_BYTES) return { error: "Photo must be under 3 MB." };
  const ext = ALLOWED[file.type];
  if (!ext) return { error: "Photo must be JPEG, PNG or WebP." };
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export function contentTypeFor(name: string) {
  const ext = name.split(".").pop();
  return Object.entries(ALLOWED).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}
