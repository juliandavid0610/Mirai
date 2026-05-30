/**
 * A tiny fixed-window rate limiter.
 *
 * Deliberately in-memory: Mirai is meant to be cloned and self-hosted, and
 * requiring a Redis instance just to demo a talking avatar is a bad trade. On
 * a single instance this stops casual abuse of the public routes. If you
 * deploy across several regions, swap this module for a shared store — the
 * interface is one function.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Evict expired windows so the map cannot grow without bound. */
function sweep(now: number): void {
  if (windows.size < 512) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000;
    windows.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, limit };
  }

  existing.count += 1;
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    limit,
  };
}

/**
 * Best-effort client identity. Behind a proxy `x-forwarded-for` is a list and
 * the first entry is the original client.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous';
  return `${scope}:${ip}`;
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
  };
}

/** Exposed for tests — resets all counters. */
export function __resetRateLimits(): void {
  windows.clear();
}
