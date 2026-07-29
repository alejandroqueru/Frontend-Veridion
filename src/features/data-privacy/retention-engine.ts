import type { VerificationEvent } from '@/features/scoring/types';
import type { PurgeReport, RetentionPolicy } from './types';
import { RETENTION_POLICIES, getPolicyForCategory } from './retention-config';

/**
 * Returns true if a single VerificationEvent has exceeded its retention window.
 * Pure function — safe to unit test without any store or localStorage.
 */
export function isExpired(
  event: VerificationEvent,
  policy: RetentionPolicy,
  now: number,
): boolean {
  return now - event.occurredAt > policy.windowMs;
}

/**
 * Splits an event array into retained and purged sets according to the
 * supplied policies. Events whose category has no matching policy are
 * always retained (fail-safe).
 *
 * Pure function — never mutates the input array.
 */
export function applyRetentionPolicies(
  events: VerificationEvent[],
  policies: readonly RetentionPolicy[],
  now: number,
): { retained: VerificationEvent[]; purged: VerificationEvent[] } {
  const retained: VerificationEvent[] = [];
  const purged: VerificationEvent[] = [];

  for (const event of events) {
    const policy = policies.find((p) => p.verificationCategory === event.category);
    if (!policy) {
      // No matching policy → always retain (fail-safe default)
      retained.push(event);
      continue;
    }
    if (isExpired(event, policy, now)) {
      purged.push(event);
    } else {
      retained.push(event);
    }
  }

  return { retained, purged };
}

/**
 * Dry-run: describes what would be purged from the given events array at
 * the given timestamp, without mutating anything.
 * Callers use this to build a PurgeReport before actually applying changes.
 */
export function runRetentionCheck(
  events: VerificationEvent[],
  now: number = Date.now(),
): PurgeReport {
  const { purged, retained } = applyRetentionPolicies(events, RETENTION_POLICIES, now);
  return {
    purgedEventIds: purged.map((e) => e.eventId),
    retainedCount: retained.length,
    ranAt: now,
  };
}

/**
 * Returns the policy that governs a specific verification category,
 * or undefined if none applies (retained by default).
 */
export function getPolicyFor(verificationCategory: string): RetentionPolicy | undefined {
  return getPolicyForCategory(verificationCategory);
}
