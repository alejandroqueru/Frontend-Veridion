import { describe, expect, it } from 'vitest';

import type { VerificationEvent } from '@/features/scoring/types';

import { buildVerificationStatus } from './status';

const NOW = 1_700_000_000_000;

function legacyEvent(providerId: string, category: string, legacyPoints: number): VerificationEvent {
  return {
    eventId: `${providerId}-1`,
    providerId,
    category,
    occurredAt: NOW,
    algorithmVersionAtCapture: 'v1',
    rawPayload: { legacyPoints },
    source: 'live',
  };
}

describe('buildVerificationStatus', () => {
  it('reports an unverified subject for an empty history', () => {
    const res = buildVerificationStatus([], { includeScoreBreakdown: false, now: NOW });
    expect(res.verified).toBe(false);
    expect(res.status).toBe('unverified');
    expect(res.humanScore).toBe(0);
    expect(res.categories).toBeUndefined();
  });

  it('reports a verified subject with a positive score', () => {
    const events = [legacyEvent('github', 'social', 6)];
    const res = buildVerificationStatus(events, { includeScoreBreakdown: false, now: NOW });
    expect(res.verified).toBe(true);
    expect(res.status).toBe('verified');
    expect(res.humanScore).toBeGreaterThan(0);
  });

  it('includes the category breakdown only when requested', () => {
    const events = [legacyEvent('github', 'social', 6)];
    const withBreakdown = buildVerificationStatus(events, { includeScoreBreakdown: true, now: NOW });
    expect(Array.isArray(withBreakdown.categories)).toBe(true);
    expect(withBreakdown.categories?.some((c) => c.category === 'social')).toBe(true);
  });
});
