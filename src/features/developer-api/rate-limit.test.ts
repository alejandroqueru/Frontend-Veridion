import { describe, expect, it } from 'vitest';

import { checkApiRateLimit } from './rate-limit';

describe('checkApiRateLimit', () => {
  it('allows requests up to the max, then blocks', () => {
    const appId = `app-${Math.random()}`;
    expect(checkApiRateLimit(appId, 2, 60_000)).toBe(true);
    expect(checkApiRateLimit(appId, 2, 60_000)).toBe(true);
    expect(checkApiRateLimit(appId, 2, 60_000)).toBe(false);
  });

  it('tracks budgets independently per app', () => {
    const a = `app-${Math.random()}`;
    const b = `app-${Math.random()}`;
    expect(checkApiRateLimit(a, 1, 60_000)).toBe(true);
    expect(checkApiRateLimit(a, 1, 60_000)).toBe(false);
    // b has its own bucket, unaffected by a.
    expect(checkApiRateLimit(b, 1, 60_000)).toBe(true);
  });
});
