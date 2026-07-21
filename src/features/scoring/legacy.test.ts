import { migrateLegacyStateToEvents, toLegacySummary, type LegacyPersistedState } from './legacy';
import { computeScoreExplanation } from './engine';
import { SCHEMA_V1, getSchema, CURRENT_ALGORITHM_VERSION } from './schema';
import type { VerificationCategory, VerificationEvent } from './types';

const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

describe('migrateLegacyStateToEvents', () => {
  it('returns an empty array for undefined/null/empty legacy state', () => {
    expect(migrateLegacyStateToEvents(undefined)).toEqual([]);
    expect(migrateLegacyStateToEvents(null)).toEqual([]);
    expect(migrateLegacyStateToEvents({ completedVerifications: {}, totalPoints: 0 })).toEqual([]);
  });

  it('converts each completed entry into one migrated-legacy event', () => {
    const legacy: LegacyPersistedState = {
      totalPoints: 12,
      completedVerifications: {
        google: {
          id: 'google',
          type: 'social',
          completed: true,
          completedAt: '2025-06-01T10:00:00.000Z',
          points: 6,
        },
        github: {
          id: 'github',
          type: 'social',
          completed: true,
          completedAt: '2025-07-01T10:00:00.000Z',
          points: 6,
        },
      },
    };

    const events = migrateLegacyStateToEvents(legacy);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.source === 'migrated-legacy')).toBe(true);
    expect(events.every((e) => e.algorithmVersionAtCapture === 'v1')).toBe(true);
    const google = events.find((e) => e.providerId === 'google');
    expect(google?.rawPayload).toEqual({ legacyPoints: 6 });
    expect(google?.occurredAt).toBe(new Date('2025-06-01T10:00:00.000Z').getTime());
  });

  it('excludes entries that are not completed', () => {
    const legacy: LegacyPersistedState = {
      totalPoints: 0,
      completedVerifications: {
        google: { id: 'google', type: 'social', completed: false, points: 6 },
      },
    };
    expect(migrateLegacyStateToEvents(legacy)).toEqual([]);
  });

  it('does not throw on a missing/malformed completedAt, defaulting occurredAt to 0', () => {
    const legacy: LegacyPersistedState = {
      totalPoints: 6,
      completedVerifications: {
        google: { id: 'google', type: 'social', completed: true, completedAt: 'not-a-date', points: 6 },
      },
    };
    expect(() => migrateLegacyStateToEvents(legacy)).not.toThrow();
    expect(migrateLegacyStateToEvents(legacy)[0].occurredAt).toBe(0);
  });

  it('does not throw when an entry references a provider id no longer in any schema', () => {
    const legacy: LegacyPersistedState = {
      totalPoints: 1000,
      completedVerifications: {
        'removed-provider': { id: 'removed-provider', type: 'physical', completed: true, points: 1000 },
      },
    };
    expect(() => migrateLegacyStateToEvents(legacy)).not.toThrow();
  });

  it('END-TO-END: recomputing under schema v1 reproduces the exact original totalPoints', () => {
    const legacy: LegacyPersistedState = {
      totalPoints: 6 + 6 + 500 + 25,
      completedVerifications: {
        google: {
          id: 'google',
          type: 'social',
          completed: true,
          completedAt: '2025-01-01T00:00:00.000Z',
          points: 6,
        },
        github: {
          id: 'github',
          type: 'social',
          completed: true,
          completedAt: '2025-02-01T00:00:00.000Z',
          points: 6,
        },
        'email-verification': {
          id: 'email-verification',
          type: 'physical',
          completed: true,
          completedAt: '2025-03-01T00:00:00.000Z',
          points: 500,
        },
        'stellar-transactions': {
          id: 'stellar-transactions',
          type: 'blockchain',
          completed: true,
          completedAt: '2025-04-01T00:00:00.000Z',
          points: 25,
        },
      },
    };

    const events = migrateLegacyStateToEvents(legacy);
    const explanation = computeScoreExplanation(events, SCHEMA_V1, NOW);

    expect(explanation.totalScore).toBe(legacy.totalPoints);
  });

  it('reproduces the original total regardless of how much time has passed (no decay in v1)', () => {
    const legacy: LegacyPersistedState = {
      totalPoints: 1000,
      completedVerifications: {
        'government-id': {
          id: 'government-id',
          type: 'physical',
          completed: true,
          completedAt: '2020-01-01T00:00:00.000Z',
          points: 1000,
        },
      },
    };
    const events = migrateLegacyStateToEvents(legacy);
    const farFuture = new Date('2035-01-01T00:00:00.000Z').getTime();
    expect(computeScoreExplanation(events, SCHEMA_V1, farFuture).totalScore).toBe(1000);
  });
});

const SCHEMA = getSchema(CURRENT_ALGORITHM_VERSION);

function makeEvent(id: string, category: VerificationCategory, points: number, occurredAt: string): VerificationEvent {
  return {
    eventId: `${id}:${occurredAt}`,
    providerId: id,
    category,
    occurredAt: new Date(occurredAt).getTime(),
    algorithmVersionAtCapture: CURRENT_ALGORITHM_VERSION,
    rawPayload: { legacyPoints: points },
    source: 'live',
  };
}

function summarize(events: VerificationEvent[], isHydrated: boolean) {
  const explanation = computeScoreExplanation(events, SCHEMA, NOW);
  return toLegacySummary(explanation, SCHEMA, isHydrated);
}

describe('toLegacySummary — pre-hydration', () => {
  it('returns an empty summary and never shows partial data', () => {
    const summary = summarize([makeEvent('google', 'social', 6, '2026-01-15T10:00:00.000Z')], false);

    expect(summary.isHydrated).toBe(false);
    expect(summary.totalPoints).toBe(0);
    expect(summary.completedCount).toBe(0);
    expect(summary.nextBestActions).toHaveLength(0);
    expect(summary.recentActivity).toHaveLength(0);
    expect(summary.totalCount).toBeGreaterThan(0);
  });
});

describe('toLegacySummary — after hydration', () => {
  it('aggregates completed verifications', () => {
    const events = [
      makeEvent('google', 'social', 6, '2026-01-15T10:00:00.000Z'),
      makeEvent('github', 'social', 6, '2026-01-20T14:30:00.000Z'),
    ];
    const summary = summarize(events, true);

    expect(summary.totalPoints).toBe(12);
    expect(summary.completedCount).toBe(2);
    expect(summary.completionPercentage).toBe(Math.round((2 / summary.totalCount) * 100));
    expect(summary.isEmpty).toBe(false);
    expect(summary.isFullyCompleted).toBe(false);
  });

  it('builds per-category point breakdown', () => {
    const events = [
      makeEvent('google', 'social', 6, '2026-01-15T10:00:00.000Z'),
      makeEvent('email-verification', 'physical', 500, '2026-01-16T10:00:00.000Z'),
    ];
    const summary = summarize(events, true);
    const social = summary.categories.find((c) => c.category === 'social');
    const physical = summary.categories.find((c) => c.category === 'physical');

    expect(social?.earnedPoints).toBe(6);
    expect(social?.completedCount).toBe(1);
    expect(physical?.earnedPoints).toBe(500);
    expect(physical?.completedCount).toBe(1);
  });

  it('lists next best actions sorted by points descending', () => {
    const summary = summarize([], true);

    expect(summary.nextBestActions.length).toBeGreaterThan(0);
    for (let i = 1; i < summary.nextBestActions.length; i++) {
      expect(summary.nextBestActions[i - 1].points).toBeGreaterThanOrEqual(summary.nextBestActions[i].points);
    }
    expect(summary.nextBestActions[0].points).toBeGreaterThanOrEqual(500);
  });

  it('excludes completed verifications from next best actions', () => {
    const summary = summarize(
      [makeEvent('government-id', 'physical', 1000, '2026-01-15T10:00:00.000Z')],
      true,
    );
    expect(summary.nextBestActions.some((a) => a.id === 'government-id')).toBe(false);
  });

  it('orders recent activity by completedAt descending', () => {
    const events = [
      makeEvent('google', 'social', 6, '2026-01-10T10:00:00.000Z'),
      makeEvent('github', 'social', 6, '2026-01-20T14:30:00.000Z'),
    ];
    const summary = summarize(events, true);

    expect(summary.recentActivity).toHaveLength(2);
    expect(summary.recentActivity[0].id).toBe('github');
    expect(summary.recentActivity[1].id).toBe('google');
  });

  it('marks fully completed state when every provider has an event', () => {
    const catalogIds = Object.keys(SCHEMA.providers).filter((id) => id !== '__unknown__');
    const events = catalogIds.map((id) =>
      makeEvent(id, SCHEMA.providers[id].category as VerificationCategory, SCHEMA.providers[id].baseWeight, '2026-01-15T10:00:00.000Z'),
    );
    const summary = summarize(events, true);

    expect(summary.isFullyCompleted).toBe(true);
    expect(summary.nextBestActions).toHaveLength(0);
  });

  it('uses the recorded points for dynamic (e.g. Stellar) verifications', () => {
    // occurredAt = NOW so Stellar's v2 decay policy doesn't reduce the raw
    // recorded value — decay behavior itself is covered by the engine tests.
    const summary = summarize(
      [makeEvent('stellar-transactions', 'blockchain', 25, new Date(NOW).toISOString())],
      true,
    );
    const blockchain = summary.categories.find((c) => c.category === 'blockchain');
    expect(blockchain?.earnedPoints).toBe(25);
    expect(blockchain?.availablePoints).toBe(50);
  });
});
