import type { RiskSignal } from '../types';

export interface VelocityConfig {
  /** Trailing window in which we count how many providers were completed. */
  windowMs: number;
  /** More than this many completions inside the window is implausibly fast for a human working through the UI. */
  maxCompletionsInWindow: number;
  /** Any two consecutive completions closer together than this are implausible on their own, regardless of total count. */
  minPlausibleGapMs: number;
}

export const DEFAULT_VELOCITY_CONFIG: VelocityConfig = {
  windowMs: 5 * 60 * 1000, // 5 min
  maxCompletionsInWindow: 3,
  minPlausibleGapMs: 2000, // 2s
};

/**
 * Pure function: given a subject's provider-completion timestamps (see
 * `store/risk-event-store.ts#timestampsForSubject`) and the current time,
 * scores implausible verification velocity — a signal distinct from device
 * correlation, since a single script could complete many providers for one
 * account without ever reusing a device signal across *other* accounts.
 *
 * Two independent sub-signals feed the score: how many completions landed
 * inside the window (scripted batch behavior), and how tight the fastest
 * gap between any two completions was (no human clicks through OAuth
 * consent screens and re-enters an OTP in under ~2s).
 */
export function computeVelocitySignal(
  timestamps: readonly number[],
  now: number,
  config: VelocityConfig = DEFAULT_VELOCITY_CONFIG,
): RiskSignal {
  const withinWindow = timestamps.filter((t) => t <= now && now - t <= config.windowMs).sort((a, b) => a - b);

  const overage = withinWindow.length - config.maxCompletionsInWindow;
  const countScore = overage > 0 ? Math.min(1, overage / config.maxCompletionsInWindow) : 0;

  let fastestGapMs = Infinity;
  for (let i = 1; i < withinWindow.length; i++) {
    fastestGapMs = Math.min(fastestGapMs, withinWindow[i] - withinWindow[i - 1]);
  }
  const gapScore =
    Number.isFinite(fastestGapMs) && fastestGapMs < config.minPlausibleGapMs
      ? 1 - fastestGapMs / config.minPlausibleGapMs
      : 0;

  const score = Math.max(countScore, gapScore);
  const gapDetail = Number.isFinite(fastestGapMs) ? `; fastest gap ${fastestGapMs}ms` : '';

  return {
    type: 'velocity',
    score,
    detail: `${withinWindow.length} completion(s) in the trailing ${config.windowMs}ms${gapDetail}.`,
  };
}
