export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
}

/**
 * Fixed-window in-memory limiter for the preview API. It is intentionally
 * per-process: a multi-instance deployment must move this to a shared store.
 */
export function createFixedWindowRateLimiter(options: RateLimiterOptions) {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) throw new Error("limit must be a positive integer");
  if (!Number.isSafeInteger(options.windowMs) || options.windowMs < 1) throw new Error("windowMs must be a positive integer");
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string): RateLimitDecision {
    const current = now();
    if (buckets.size > maxKeys) {
      for (const [candidate, bucket] of buckets) {
        if (current >= bucket.resetAt) buckets.delete(candidate);
      }
    }
    const bucket = buckets.get(key);
    if (!bucket || current >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: current + options.windowMs });
      return {
        allowed: true,
        remaining: options.limit - 1,
        retryAfterSeconds: Math.ceil(options.windowMs / 1000),
      };
    }
    if (bucket.count >= options.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)),
      };
    }
    bucket.count += 1;
    return {
      allowed: true,
      remaining: options.limit - bucket.count,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)),
    };
  };
}
