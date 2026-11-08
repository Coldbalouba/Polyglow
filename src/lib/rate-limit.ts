/**
 * Small in-memory rate limiter (fixed window). Polyglow runs as one server process,
 * so memory is enough; counters reset on restart, which is fine for slowing down guessing.
 */
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  hit.count++;
  if (hit.count > limit) return { ok: false, retryAfterSec: Math.ceil((hit.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
