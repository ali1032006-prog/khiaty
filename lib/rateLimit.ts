import { headers } from "next/headers";

/**
 * Small in-memory rate limiter (fixed window). Good enough for one server process; for several
 * instances move the counters to the database or Redis. Keys are namespaced by caller.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false as const, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true as const, retryAfterSec: 0 };
}

/** Best-effort client address. Behind a trusted proxy use the first X-Forwarded-For entry. */
export async function clientIp() {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  return (xff ? xff.split(",")[0].trim() : h.get("x-real-ip")) || "unknown";
}
