import { describe, expect, it } from 'vitest';

import type { VerificationEvent } from '@/features/scoring/types';

import { buildBadgeStatus } from './public-badge';

const NOW = 1_700_000_000_000;

describe('buildBadgeStatus', () => {
  it('is unverified for an empty history', () => {
    expect(buildBadgeStatus([], NOW)).toEqual({ verified: false, status: 'unverified' });
  });

  it('is verified when there is a scoring signal', () => {
    const events: VerificationEvent[] = [
      {
        eventId: 'e1',
        providerId: 'github',
        category: 'social',
        occurredAt: NOW,
        algorithmVersionAtCapture: 'v1',
        rawPayload: { legacyPoints: 6 },
        source: 'live',
      },
    ];
    expect(buildBadgeStatus(events, NOW)).toEqual({ verified: true, status: 'verified' });
  });

  it('never leaks score or category detail', () => {
    const result = buildBadgeStatus([], NOW) as Record<string, unknown>;
    expect(Object.keys(result).sort()).toEqual(['status', 'verified']);
  });
});
