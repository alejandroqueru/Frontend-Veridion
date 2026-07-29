import type { RiskSignal } from '../types';

export interface CorrelationConfig {
  /** How far back to look when counting distinct accounts under one device/network signal. */
  windowMs: number;
  /** Distinct accounts at or below this count in the window is considered normal (e.g. a shared family device). */
  maxDistinctSubjects: number;
}

export const DEFAULT_CORRELATION_CONFIG: CorrelationConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 24h
  maxDistinctSubjects: 3,
};

/**
 * Pure function: given the distinct subjects already observed under a
 * device/network signal within the window (see
 * `store/risk-event-store.ts#distinctSubjectsForFingerprint`), scores how
 * anomalous the fan-out is. Scales linearly past the threshold and caps at
 * 1 once the count reaches double the threshold — a bot farm running dozens
 * of identities through one browser image doesn't need to be distinguished
 * further past "this is clearly not normal shared-device usage".
 */
export function computeCorrelationSignal(
  distinctSubjects: readonly string[],
  config: CorrelationConfig = DEFAULT_CORRELATION_CONFIG,
): RiskSignal {
  const count = distinctSubjects.length;
  const overage = count - config.maxDistinctSubjects;
  const score = overage > 0 ? Math.min(1, overage / config.maxDistinctSubjects) : 0;

  return {
    type: 'device-correlation',
    score,
    detail: `${count} distinct account(s) shared this device/network signal within ${config.windowMs}ms (threshold ${config.maxDistinctSubjects}).`,
  };
}
