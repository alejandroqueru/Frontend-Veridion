import {
  computeDecay,
  selectActiveEvents,
  createFallbackProvider,
  safeScoreFromSignals,
  computeScoreExplanation,
} from './engine';
import { SCHEMA_V1 } from './schema';
import type { ProviderConfig, ScoringSchema, VerificationEvent } from './types';

const DAY_MS = 86_400_000;
const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

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

// ── computeDecay ─────────────────────────────────────────────────────

describe('computeDecay — none', () => {
  it('always returns 1 regardless of age', () => {
    expect(computeDecay({ kind: 'none' }, 0)).toBe(1);
    expect(computeDecay({ kind: 'none' }, 1000 * DAY_MS)).toBe(1);
  });
});

describe('computeDecay — linear', () => {
  const policy = { kind: 'linear' as const, halfLifeDays: 90, floor: 0.3 };

  it('returns 1 at age 0', () => {
    expect(computeDecay(policy, 0)).toBe(1);
  });

  it('returns the floor exactly at 2x halfLife', () => {
    expect(computeDecay(policy, 180 * DAY_MS)).toBeCloseTo(0.3, 5);
  });

  it('clamps to the floor beyond 2x halfLife', () => {
    expect(computeDecay(policy, 1000 * DAY_MS)).toBe(0.3);
  });

  it('interpolates linearly between 0 and 2x halfLife', () => {
    const atHalfLife = computeDecay(policy, 90 * DAY_MS);
    expect(atHalfLife).toBeGreaterThan(0.3);
    expect(atHalfLife).toBeLessThan(1);
    expect(atHalfLife).toBeCloseTo(0.65, 5);
  });

  it('defaults floor to 0.2 when omitted', () => {
    const result = computeDecay({ kind: 'linear', halfLifeDays: 10 }, 10_000 * DAY_MS);
    expect(result).toBe(0.2);
  });

  it('never returns a negative weight for zero halfLifeDays', () => {
    expect(computeDecay({ kind: 'linear', halfLifeDays: 0, floor: 0.1 }, 5 * DAY_MS)).toBe(0.1);
  });
});

describe('computeDecay — step', () => {
  const policy = {
    kind: 'step' as const,
    steps: [
      { afterDays: 30, weight: 0.7 },
      { afterDays: 90, weight: 0.4 },
    ],
  };

  it('returns full weight before the first step', () => {
    expect(computeDecay(policy, 10 * DAY_MS)).toBe(1);
  });

  it('applies the correct step for age between thresholds', () => {
    expect(computeDecay(policy, 45 * DAY_MS)).toBe(0.7);
  });

  it('applies the last matching step beyond all thresholds', () => {
    expect(computeDecay(policy, 200 * DAY_MS)).toBe(0.4);
  });

  it('is order-independent — unsorted steps behave the same', () => {
    const unsorted = { kind: 'step' as const, steps: [...policy.steps].reverse() };
    expect(computeDecay(unsorted, 200 * DAY_MS)).toBe(0.4);
  });

  it('respects an explicit floor even if lower than any step weight', () => {
    const withFloor = { ...policy, floor: 0.5 };
    expect(computeDecay(withFloor, 200 * DAY_MS)).toBe(0.5);
  });
});

describe('computeDecay — negative age (clock skew defense)', () => {
  it('treats negative ageMs as age 0', () => {
    expect(computeDecay({ kind: 'linear', halfLifeDays: 90, floor: 0.3 }, -1000)).toBe(1);
    expect(computeDecay({ kind: 'none' }, -1000)).toBe(1);
  });
});

// ── selectActiveEvents ───────────────────────────────────────────────

describe('selectActiveEvents', () => {
  it('returns an empty map for an empty event list', () => {
    expect(selectActiveEvents([]).size).toBe(0);
  });

  it('picks the single event for a provider with one event', () => {
    const event = makeEvent({});
    const active = selectActiveEvents([event]);
    expect(active.get('google')).toBe(event);
  });

  it('picks the latest event by occurredAt regardless of array order', () => {
    const older = makeEvent({ eventId: 'e1', occurredAt: 1000 });
    const newer = makeEvent({ eventId: 'e2', occurredAt: 5000 });

    expect(selectActiveEvents([older, newer]).get('google')).toBe(newer);
    expect(selectActiveEvents([newer, older]).get('google')).toBe(newer);
  });

  it('breaks ties on identical occurredAt using eventId', () => {
    const a = makeEvent({ eventId: 'a', occurredAt: 1000 });
    const b = makeEvent({ eventId: 'b', occurredAt: 1000 });
    expect(selectActiveEvents([a, b]).get('google')).toBe(b);
    expect(selectActiveEvents([b, a]).get('google')).toBe(b);
  });

  it('tracks providers independently', () => {
    const google = makeEvent({ eventId: 'g1', providerId: 'google', occurredAt: 1000 });
    const stellar = makeEvent({ eventId: 's1', providerId: 'stellar-transactions', occurredAt: 2000 });

    const active = selectActiveEvents([google, stellar]);
    expect(active.size).toBe(2);
    expect(active.get('google')).toBe(google);
    expect(active.get('stellar-transactions')).toBe(stellar);
  });

  it('older superseded events are not returned even though they existed', () => {
    const first = makeEvent({ eventId: 'e1', occurredAt: 1000 });
    const second = makeEvent({ eventId: 'e2', occurredAt: 2000 });
    const third = makeEvent({ eventId: 'e3', occurredAt: 3000 });

    const active = selectActiveEvents([first, second, third]);
    expect(active.get('google')).toBe(third);
    expect([...active.values()]).not.toContain(first);
    expect([...active.values()]).not.toContain(second);
  });
});

// ── createFallbackProvider / safeScoreFromSignals ─────────────────────

describe('createFallbackProvider', () => {
  it('has zero base weight and no decay', () => {
    const fallback = createFallbackProvider();
    expect(fallback.baseWeight).toBe(0);
    expect(fallback.decay).toEqual({ kind: 'none' });
  });
});

describe('safeScoreFromSignals', () => {
  it('returns multiplier 1 when scoreFromSignals is omitted (boolean providers)', () => {
    const provider: ProviderConfig = {
      id: 'google',
      category: 'social',
      label: 'Google',
      baseWeight: 6,
      decay: { kind: 'none' },
    };
    expect(safeScoreFromSignals(provider, {})).toEqual({ multiplier: 1 });
  });

  it('clamps a valid multiplier into [0,1]', () => {
    const provider: ProviderConfig = {
      id: 'over',
      category: 'social',
      label: 'Over',
      baseWeight: 10,
      decay: { kind: 'none' },
      scoreFromSignals: () => 1.5,
    };
    expect(safeScoreFromSignals(provider, {}).multiplier).toBe(1);
  });

  it('degrades to 0 with a warning when scoreFromSignals throws', () => {
    const provider: ProviderConfig = {
      id: 'broken',
      category: 'social',
      label: 'Broken',
      baseWeight: 10,
      decay: { kind: 'none' },
      scoreFromSignals: () => {
        throw new Error('boom');
      },
    };
    const result = safeScoreFromSignals(provider, {});
    expect(result.multiplier).toBe(0);
    expect(result.error).toContain('threw');
  });

  it('degrades to 0 with a warning when scoreFromSignals returns non-finite', () => {
    const provider: ProviderConfig = {
      id: 'nan',
      category: 'social',
      label: 'NaN',
      baseWeight: 10,
      decay: { kind: 'none' },
      scoreFromSignals: () => NaN,
    };
    const result = safeScoreFromSignals(provider, {});
    expect(result.multiplier).toBe(0);
    expect(result.error).toContain('non-finite');
  });
});

// ── computeScoreExplanation ────────────────────────────────────────────

/** Small self-contained schema so category-cap/decay tests don't depend on SCHEMA_V1's real numbers. */
const TEST_SCHEMA: ScoringSchema = {
  version: 'test',
  categories: [{ category: 'alpha', label: 'Alpha', cap: 10 }],
  providers: {
    a: { id: 'a', category: 'alpha', label: 'A', baseWeight: 8, decay: { kind: 'none' } },
    b: { id: 'b', category: 'alpha', label: 'B', baseWeight: 8, decay: { kind: 'none' } },
    decaying: {
      id: 'decaying',
      category: 'alpha',
      label: 'Decaying',
      baseWeight: 10,
      decay: { kind: 'linear', halfLifeDays: 90, floor: 0.3 },
    },
  },
  fallbackProvider: { id: '__unknown__', category: 'unknown', label: 'Unknown', baseWeight: 0, decay: { kind: 'none' } },
};

describe('computeScoreExplanation — empty input', () => {
  it('returns zero total and no throw', () => {
    const explanation = computeScoreExplanation([], SCHEMA_V1, NOW);
    expect(explanation.totalScore).toBe(0);
    expect(explanation.warnings).toEqual([]);
    expect(explanation.categories.every((c) => c.earnedPoints === 0)).toBe(true);
  });
});

describe('computeScoreExplanation — boolean providers', () => {
  it('contributes full baseWeight for a simple completed provider', () => {
    const explanation = computeScoreExplanation([makeEvent({ providerId: 'google' })], SCHEMA_V1, NOW);
    expect(explanation.totalScore).toBe(6);
    const social = explanation.categories.find((c) => c.category === 'social');
    expect(social?.providers[0].cappedPoints).toBe(6);
  });

  it('aggregates points across categories', () => {
    const events = [
      makeEvent({ eventId: 'g', providerId: 'google', category: 'social' }),
      makeEvent({ eventId: 'e', providerId: 'email-verification', category: 'physical' }),
    ];
    const explanation = computeScoreExplanation(events, SCHEMA_V1, NOW);
    expect(explanation.totalScore).toBe(6 + 500);
  });
});

describe('computeScoreExplanation — category cap overflow', () => {
  it('proportionally scales providers down to the category cap', () => {
    const events = [
      makeEvent({ eventId: 'a', providerId: 'a', category: 'alpha' }),
      makeEvent({ eventId: 'b', providerId: 'b', category: 'alpha' }),
    ];
    const explanation = computeScoreExplanation(events, TEST_SCHEMA, NOW);
    const alpha = explanation.categories.find((c) => c.category === 'alpha')!;

    expect(alpha.earnedPoints).toBeCloseTo(10, 5); // capped, not 16
    expect(alpha.providers[0].cappedPoints).toBeCloseTo(5, 5);
    expect(alpha.providers[1].cappedPoints).toBeCloseTo(5, 5);
  });

  it('does not scale when under the cap', () => {
    const explanation = computeScoreExplanation(
      [makeEvent({ providerId: 'a', category: 'alpha' })],
      TEST_SCHEMA,
      NOW,
    );
    const alpha = explanation.categories.find((c) => c.category === 'alpha')!;
    expect(alpha.earnedPoints).toBe(8);
  });
});

describe('computeScoreExplanation — decay applied at various offsets', () => {
  it('applies full weight at age 0', () => {
    const explanation = computeScoreExplanation(
      [makeEvent({ providerId: 'decaying', category: 'alpha', occurredAt: NOW })],
      TEST_SCHEMA,
      NOW,
    );
    expect(explanation.categories[0].providers[0].contributedPoints).toBe(10);
  });

  it('applies reduced weight further in the past', () => {
    const explanation = computeScoreExplanation(
      [makeEvent({ providerId: 'decaying', category: 'alpha', occurredAt: NOW - 180 * DAY_MS })],
      TEST_SCHEMA,
      NOW,
    );
    expect(explanation.categories[0].providers[0].contributedPoints).toBeCloseTo(3, 5); // 10 * 0.3 floor
  });
});

describe('computeScoreExplanation — determinism', () => {
  it('produces identical output across repeated calls with the same input', () => {
    const events = [makeEvent({ providerId: 'google' }), makeEvent({ eventId: 'e2', providerId: 'github' })];
    const first = computeScoreExplanation(events, SCHEMA_V1, NOW);
    const second = computeScoreExplanation(events, SCHEMA_V1, NOW);
    expect(first).toEqual(second);
  });

  it('never mutates the input events array', () => {
    const events = [makeEvent({ providerId: 'google' })];
    const snapshot = JSON.stringify(events);
    computeScoreExplanation(events, SCHEMA_V1, NOW);
    expect(JSON.stringify(events)).toBe(snapshot);
  });
});

describe('computeScoreExplanation — legacy points reproduction', () => {
  it('uses rawPayload.legacyPoints directly, ignoring baseWeight/scoreFromSignals', () => {
    const explanation = computeScoreExplanation(
      [
        makeEvent({
          providerId: 'stellar-transactions',
          category: 'blockchain',
          rawPayload: { legacyPoints: 25 },
        }),
      ],
      SCHEMA_V1,
      NOW,
    );
    const blockchain = explanation.categories.find((c) => c.category === 'blockchain')!;
    expect(blockchain.providers[0].rawWeight).toBe(25);
    expect(blockchain.earnedPoints).toBe(25);
  });
});

describe('computeScoreExplanation — superseded events', () => {
  it('only the latest event per provider contributes', () => {
    const events = [
      makeEvent({ eventId: 'e1', providerId: 'google', category: 'social', occurredAt: NOW - 1000 }),
      makeEvent({ eventId: 'e2', providerId: 'google', category: 'social', occurredAt: NOW }),
    ];
    const explanation = computeScoreExplanation(events, SCHEMA_V1, NOW);
    expect(explanation.totalScore).toBe(6); // not 12
    expect(explanation.history).toHaveLength(2); // both preserved in history
  });
});

describe('computeScoreExplanation — unknown provider', () => {
  it('scores an unrecognized providerId at fallback weight with a warning, never throws', () => {
    expect(() =>
      computeScoreExplanation([makeEvent({ providerId: 'some-future-provider', category: 'social' })], SCHEMA_V1, NOW),
    ).not.toThrow();

    const explanation = computeScoreExplanation(
      [makeEvent({ providerId: 'some-future-provider', category: 'social' })],
      SCHEMA_V1,
      NOW,
    );
    expect(explanation.totalScore).toBe(0);
    expect(explanation.warnings.some((w) => w.includes('some-future-provider'))).toBe(true);
    expect(explanation.categories.find((c) => c.category === 'social')?.providers[0].isUnknownProvider).toBe(true);
  });
});

describe('computeScoreExplanation — algorithm version metadata', () => {
  it('echoes the schema version and computedAt back in the explanation', () => {
    const explanation = computeScoreExplanation([], TEST_SCHEMA, NOW);
    expect(explanation.algorithmVersion).toBe('test');
    expect(explanation.computedAt).toBe(NOW);
  });
});
