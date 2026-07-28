import { buildPassportSnapshot } from './snapshot';
import { computeScoreExplanation } from '@/features/scoring/engine';
import { SCHEMA_V1 } from '@/features/scoring/schema';
import type { ProviderContribution, ScoreExplanation } from '@/features/scoring/types';
import type { VerificationEvent } from '@/features/scoring/types';

const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

function makeProvider(overrides: Partial<ProviderContribution>): ProviderContribution {
  return {
    providerId: 'google',
    category: 'social',
    label: 'Google',
    activeEventId: 'e1',
    occurredAt: NOW,
    rawWeight: 6,
    decayFactor: 1,
    contributedPoints: 6,
    cappedPoints: 6,
    isUnknownProvider: false,
    eventCount: 1,
    ...overrides,
  };
}

function makeExplanation(overrides: Partial<ScoreExplanation>): ScoreExplanation {
  return {
    algorithmVersion: 'v2',
    computedAt: NOW,
    totalScore: 6,
    categories: [
      {
        category: 'social',
        label: 'Social',
        earnedPoints: 6,
        cap: 24,
        providers: [makeProvider({})],
      },
    ],
    history: [],
    warnings: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<VerificationEvent>): VerificationEvent {
  return {
    eventId: 'e1',
    providerId: 'google',
    category: 'social',
    occurredAt: NOW,
    algorithmVersionAtCapture: 'v1',
    rawPayload: {},
    source: 'live',
    ...overrides,
  };
}

describe('buildPassportSnapshot — basic field mapping', () => {
  it('carries algorithmVersion/computedAt/totalScore straight through', () => {
    const snapshot = buildPassportSnapshot(makeExplanation({ algorithmVersion: 'v2', computedAt: 12345, totalScore: 99 }));
    expect(snapshot.algorithmVersion).toBe('v2');
    expect(snapshot.computedAt).toBe(12345);
    expect(snapshot.totalScore).toBe(99);
  });

  it('maps category cap/earnedPoints/label unchanged', () => {
    const snapshot = buildPassportSnapshot(makeExplanation({}));
    expect(snapshot.categories[0]).toMatchObject({ category: 'social', label: 'Social', earnedPoints: 6, cap: 24 });
  });

  it('maps provider points from cappedPoints (not rawWeight/contributedPoints)', () => {
    const explanation = makeExplanation({
      categories: [
        {
          category: 'social',
          label: 'Social',
          earnedPoints: 3,
          cap: 24,
          providers: [makeProvider({ rawWeight: 6, contributedPoints: 6, cappedPoints: 3 })],
        },
      ],
    });
    expect(buildPassportSnapshot(explanation).categories[0].providers[0].points).toBe(3);
  });
});

describe('buildPassportSnapshot — extensibility (unknown/future providers survive untouched)', () => {
  it('passes through a providerId with no registry/schema knowledge, unknown flag intact', () => {
    const explanation = makeExplanation({
      categories: [
        {
          category: 'social',
          label: 'Social',
          earnedPoints: 0,
          cap: 24,
          providers: [
            makeProvider({ providerId: 'proof-of-personhood', label: 'Proof of Personhood', isUnknownProvider: true, cappedPoints: 0 }),
          ],
        },
      ],
    });

    const snapshot = buildPassportSnapshot(explanation);
    const provider = snapshot.categories[0].providers[0];
    expect(provider.providerId).toBe('proof-of-personhood');
    expect(provider.isUnknownProvider).toBe(true);
    expect(provider.label).toBe('Proof of Personhood');
  });

  it('never throws on an empty explanation', () => {
    expect(() =>
      buildPassportSnapshot({ algorithmVersion: 'v2', computedAt: 0, totalScore: 0, categories: [], history: [], warnings: [] }),
    ).not.toThrow();
  });
});

describe('buildPassportSnapshot — integration with the real scoring engine', () => {
  it('produces a snapshot whose total matches the engine output exactly for real events', () => {
    const events = [makeEvent({ providerId: 'google' }), makeEvent({ eventId: 'e2', providerId: 'github' })];
    const explanation = computeScoreExplanation(events, SCHEMA_V1, NOW);
    const snapshot = buildPassportSnapshot(explanation);

    expect(snapshot.totalScore).toBe(explanation.totalScore);
    expect(snapshot.categories.flatMap((c) => c.providers)).toHaveLength(2);
  });
});
