import type { RiskAssessment, RiskSignal, RiskSignalType } from '../types';

/**
 * Relative weight of each signal in the aggregate 0-100 score. Sums to 100
 * so a single maxed-out signal (score 1) alone can still reach a high but
 * not-quite-total score — no single heuristic is treated as proof on its
 * own, matching how each signal is independently falsifiable (a shared
 * office device, a fast but legitimate power user, a real toll-free line).
 */
const SIGNAL_WEIGHTS: Record<RiskSignalType, number> = {
  'device-correlation': 45,
  velocity: 30,
  'disposable-phone': 25,
};

export interface RiskEngineInput {
  subject: string;
  correlation: RiskSignal;
  velocity: RiskSignal;
  /** Omitted when no phone number was part of this signal (e.g. a GitHub/Discord completion). */
  disposablePhone?: RiskSignal;
  now: number;
}

/**
 * Combines independent signals into a single aggregate risk score. Pure
 * function — no store access, no Human Score dependency. Computed and
 * stored (via `service.ts`) entirely separately from
 * `features/scoring/engine.ts`'s Human Score.
 */
export function computeRiskAssessment(input: RiskEngineInput): RiskAssessment {
  const signals = [input.correlation, input.velocity, input.disposablePhone].filter(
    (signal): signal is RiskSignal => signal !== undefined,
  );

  const rawScore = signals.reduce((sum, signal) => sum + signal.score * SIGNAL_WEIGHTS[signal.type], 0);

  return {
    subject: input.subject,
    score: Math.round(Math.min(100, rawScore)),
    signals,
    computedAt: input.now,
  };
}
