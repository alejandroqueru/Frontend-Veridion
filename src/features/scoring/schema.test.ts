import { getSchema, CURRENT_ALGORITHM_VERSION, SCHEMA_VERSIONS, SCHEMA_V1, SCHEMA_V2 } from './schema';
import { computeScoreExplanation } from './engine';
import { buildSignalBundle } from './types';
import type { VerificationEvent } from './types';
import { socialMediaVerifications } from '@/features/verifications/constants/social-verifications';
import { physicalVerifications } from '@/features/verifications/constants/physical-verifications';

const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

/** The old verification-summary.ts hardcoded this override for the dynamically-scored Stellar provider; the schema now owns that number directly. */
const STELLAR_MAX_POINTS = 50;

describe('getSchema', () => {
  it('returns the requested version when known', () => {
    expect(getSchema('v1')).toBe(SCHEMA_V1);
  });

  it('falls back to the current version for an unknown version string, never throws', () => {
    expect(() => getSchema('v999-does-not-exist')).not.toThrow();
    expect(getSchema('v999-does-not-exist')).toBe(SCHEMA_VERSIONS[CURRENT_ALGORITHM_VERSION]);
  });
});

describe('SCHEMA_V1 — parity with today\'s hardcoded catalog values', () => {
  it('matches every social provider point value exactly', () => {
    for (const item of socialMediaVerifications) {
      expect(SCHEMA_V1.providers[item.id]?.baseWeight).toBe(item.points);
    }
  });

  it('matches every physical provider point value exactly', () => {
    for (const item of physicalVerifications) {
      expect(SCHEMA_V1.providers[item.id]?.baseWeight).toBe(item.points);
    }
  });

  it('matches the Stellar max-points override', () => {
    expect(SCHEMA_V1.providers['stellar-transactions']?.baseWeight).toBe(STELLAR_MAX_POINTS);
  });

  it('has no decay for any v1 provider (behaves identically to the current app)', () => {
    for (const provider of Object.values(SCHEMA_V1.providers)) {
      expect(provider.decay.kind).toBe('none');
    }
  });
});

describe('schema version authoring guard', () => {
  it('v2 declares every provider that v1 declares (no orphaned historical events)', () => {
    for (const providerId of Object.keys(SCHEMA_V1.providers)) {
      expect(SCHEMA_V2.providers[providerId]).toBeDefined();
    }
  });
});

describe('v1 vs v2 scoring for the same Stellar event', () => {
  const signalEvent: VerificationEvent = {
    eventId: 'e1',
    providerId: 'stellar-transactions',
    category: 'blockchain',
    occurredAt: NOW,
    algorithmVersionAtCapture: 'v2',
    rawPayload: {
      signals: buildSignalBundle({
        txVolumeTier: 0.9,
        accountAgeDays: 0.8,
        activityRecency: 1,
        operationDiversity: 0.7,
      }),
    },
    source: 'live',
  };

  it('v1 ignores the signal bundle (no txCount field) and scores 0', () => {
    const explanation = computeScoreExplanation([signalEvent], SCHEMA_V1, NOW);
    expect(explanation.totalScore).toBe(0);
  });

  it('v2 scores from the normalized signals, producing a non-zero, non-full total', () => {
    const explanation = computeScoreExplanation([signalEvent], SCHEMA_V2, NOW);
    expect(explanation.totalScore).toBeGreaterThan(0);
    expect(explanation.totalScore).toBeLessThan(50);
  });

  it('the two algorithm versions produce different totals for identical input', () => {
    const v1Total = computeScoreExplanation([signalEvent], SCHEMA_V1, NOW).totalScore;
    const v2Total = computeScoreExplanation([signalEvent], SCHEMA_V2, NOW).totalScore;
    expect(v1Total).not.toBe(v2Total);
  });
});

describe('migrated legacy events remain reproducible under v1 regardless of v2 changes', () => {
  it('a legacyPoints payload scores identically whether v2 exists or not', () => {
    const event: VerificationEvent = {
      eventId: 'legacy:google',
      providerId: 'google',
      category: 'social',
      occurredAt: NOW,
      algorithmVersionAtCapture: 'v1',
      rawPayload: { legacyPoints: 6 },
      source: 'migrated-legacy',
    };
    const explanation = computeScoreExplanation([event], SCHEMA_V1, NOW);
    expect(explanation.totalScore).toBe(6);
  });
});
