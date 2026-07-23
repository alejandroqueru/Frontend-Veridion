import { checkRateLimit } from '@/features/verifications/services/rate-limiter';

// Per-key rate limiting for the public API. This deliberately reuses the
// existing token-bucket in `verifications/services/rate-limiter.ts` (the issue
// asks us to extend it rather than introduce a second mechanism) — we just call
// it with an API-specific key namespace and limits.
//
// Caveat: that limiter is in-memory, so counters reset on restart and are not
// shared across instances. That is acceptable for a single-instance / preview
// deployment; production should back the same interface with a shared store
// (see docs/public-api.md "Roadmap").

export const API_RATE_LIMIT_MAX = 60;
export const API_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 requests / minute

/**
 * Consume one unit of an app's public-API budget.
 * @returns true if the request is allowed, false if the app is over its limit.
 */
export function checkApiRateLimit(
  appId: string,
  max: number = API_RATE_LIMIT_MAX,
  windowMs: number = API_RATE_LIMIT_WINDOW_MS,
): boolean {
  return checkRateLimit(`api:${appId}`, max, windowMs);
}
