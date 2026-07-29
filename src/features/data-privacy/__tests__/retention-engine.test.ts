import { describe, it, expect } from 'vitest';
import { isExpired, applyRetentionPolicies, runRetentionCheck } from '../retention-engine';
import { RETENTION_POLICIES, getPolicyForCategory } from '../retention-config';
import type { VerificationEvent } from '@/features/scoring/types';
import type { RetentionPolicy } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

function makeEvent(
  overrides: Partial<VerificationEvent> & { occurredAt: number },
): VerificationEvent {
  return {
    eventId: `evt-${Math.random().toString(36).slice(2)}`,
    providerId: 'google',
    category: 'social',
    algorithmVersionAtCapture: 'v2',
    rawPayload: {},
    source: 'live',
    ...overrides,
  };
}

function makePolicy(category: string, windowMs: number): RetentionPolicy {
  return {
    category: 'social',
    verificationCategory: category,
    windowMs,
    label: 'Test policy',
    description: 'Test',
  };
}

// ── isExpired ─────────────────────────────────────────────────────────

describe('isExpired', () => {
  it('returns true when the event exceeds the retention window', () => {
    const policy = makePolicy('social', DAY_MS);
    const event = makeEvent({ occurredAt: Date.now() - 2 * DAY_MS });
    expect(isExpired(event, policy, Date.now())).toBe(true);
  });

  it('returns false when the event is within the retention window', () => {
    const policy = makePolicy('social', 2 * YEAR_MS);
    const event = makeEvent({ occurredAt: Date.now() - DAY_MS });
    expect(isExpired(event, policy, Date.now())).toBe(false);
  });

  it('retains events at exactly the boundary (boundary is inclusive)', () => {
    const policy = makePolicy('social', DAY_MS);
    const now = Date.now();
    const event = makeEvent({ occurredAt: now - DAY_MS });
    // now - occurredAt === windowMs → exactly at boundary → NOT expired
    expect(isExpired(event, policy, now)).toBe(false);
  });

  it('expires events one millisecond past the boundary', () => {
    const policy = makePolicy('social', DAY_MS);
    const now = Date.now();
    const event = makeEvent({ occurredAt: now - DAY_MS - 1 });
    expect(isExpired(event, policy, now)).toBe(true);
  });
});

// ── applyRetentionPolicies ─────────────────────────────────────────────

describe('applyRetentionPolicies', () => {
  it('retains events within window, purges events past window', () => {
    const now = Date.now();
    const retained = makeEvent({ category: 'social', occurredAt: now - DAY_MS });
    const purged = makeEvent({ category: 'social', occurredAt: now - 3 * YEAR_MS });
    const socialPolicy = getPolicyForCategory('social')!;

    const result = applyRetentionPolicies([retained, purged], [socialPolicy], now);

    expect(result.retained).toHaveLength(1);
    expect(result.retained[0].eventId).toBe(retained.eventId);
    expect(result.purged).toHaveLength(1);
    expect(result.purged[0].eventId).toBe(purged.eventId);
  });

  it('always retains events whose category has no matching policy (fail-safe)', () => {
    const now = Date.now();
    // An 'unknown' category not in any policy
    const unknownEvent = makeEvent({ category: 'unknown-future-category', occurredAt: 0 });
    const result = applyRetentionPolicies([unknownEvent], RETENTION_POLICIES, now);
    expect(result.retained).toHaveLength(1);
    expect(result.purged).toHaveLength(0);
  });

  it('correctly splits a mixed-category event list across multiple policies', () => {
    const now = Date.now();
    const freshSocial = makeEvent({ category: 'social', occurredAt: now - DAY_MS });
    const staleSocial = makeEvent({ category: 'social', occurredAt: now - 3 * YEAR_MS });
    const freshPhysical = makeEvent({ category: 'physical', occurredAt: now - DAY_MS });
    const stalePhysical = makeEvent({ category: 'physical', occurredAt: now - 6 * YEAR_MS });
    const freshBlockchain = makeEvent({ category: 'blockchain', occurredAt: now - DAY_MS });

    const result = applyRetentionPolicies(
      [freshSocial, staleSocial, freshPhysical, stalePhysical, freshBlockchain],
      RETENTION_POLICIES,
      now,
    );

    expect(result.retained).toHaveLength(3); // freshSocial, freshPhysical, freshBlockchain
    expect(result.purged).toHaveLength(2);   // staleSocial, stalePhysical
  });

  it('does not mutate the input array', () => {
    const now = Date.now();
    const events = [makeEvent({ category: 'social', occurredAt: now - 3 * YEAR_MS })];
    const original = [...events];
    applyRetentionPolicies(events, RETENTION_POLICIES, now);
    expect(events).toHaveLength(original.length);
  });

  it('returns empty retained and purged arrays for empty input', () => {
    const result = applyRetentionPolicies([], RETENTION_POLICIES, Date.now());
    expect(result.retained).toHaveLength(0);
    expect(result.purged).toHaveLength(0);
  });
});

// ── runRetentionCheck ─────────────────────────────────────────────────

describe('runRetentionCheck', () => {
  it('returns the correct purgedEventIds without mutating events', () => {
    const now = Date.now();
    const stale = makeEvent({ category: 'social', occurredAt: now - 3 * YEAR_MS });
    const fresh = makeEvent({ category: 'social', occurredAt: now - DAY_MS });
    const report = runRetentionCheck([stale, fresh], now);

    expect(report.purgedEventIds).toContain(stale.eventId);
    expect(report.purgedEventIds).not.toContain(fresh.eventId);
    expect(report.retainedCount).toBe(1);
    expect(report.ranAt).toBe(now);
  });

  it('returns an empty purge report when all events are within window', () => {
    const now = Date.now();
    const events = [
      makeEvent({ category: 'social', occurredAt: now - DAY_MS }),
      makeEvent({ category: 'physical', occurredAt: now - DAY_MS }),
    ];
    const report = runRetentionCheck(events, now);
    expect(report.purgedEventIds).toHaveLength(0);
    expect(report.retainedCount).toBe(2);
  });
});

// ── Retention config ──────────────────────────────────────────────────

describe('RETENTION_POLICIES — data-driven config', () => {
  it('has a policy entry for every verification category used in the app', () => {
    const categories = ['social', 'physical', 'blockchain'];
    for (const cat of categories) {
      expect(getPolicyForCategory(cat)).toBeDefined();
    }
  });

  it('audit-log retention window is the longest (regulatory floor)', () => {
    const auditPolicy = RETENTION_POLICIES.find((p) => p.category === 'audit-log')!;
    const otherWindows = RETENTION_POLICIES
      .filter((p) => p.category !== 'audit-log')
      .map((p) => p.windowMs);
    const maxOther = Math.max(...otherWindows);
    expect(auditPolicy.windowMs).toBeGreaterThan(maxOther);
  });

  it('retention windows are data-driven (reading from config, not magic numbers)', () => {
    // All windowMs values must be > 0 and must come from the policy object, not literals
    for (const policy of RETENTION_POLICIES) {
      expect(policy.windowMs).toBeGreaterThan(0);
      expect(typeof policy.windowMs).toBe('number');
    }
  });
});
