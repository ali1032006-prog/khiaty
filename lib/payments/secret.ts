import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** 256-bit random secret, URL-safe. Given to the gateway once; we keep only its hash. */
export function newCallbackSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/** Constant-time comparison of a presented secret against the stored hash. */
export function secretMatches(presented: string, storedHash: string) {
  const a = Buffer.from(hashSecret(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
