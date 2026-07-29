import type { RiskAssessment, RiskSignal, RiskSignalType } from '../types';

/**
 * Relative weight of each signal in the aggregate 0-100 score. Sums to 100
 * so a single maxed-out signal (score 1) alone can still reach a high but
 * not-quite-total score — no single heuristic is treated as proof on its
 * own, matching how each signal is independently falsifiable (a shared
 * office device, a fast but legitimate power user, a real toll-free line).
 *
 * Device correlation and velocity carry the most weight — they're the
 * hardest for a bot farm to fake cheaply. Network correlation is weaker
 * (IPs are shared by real people far more than device fingerprints are —
 * see network-correlation-engine.ts) and geo-mismatch is the weakest of
 * all: it's a coarse plausibility check on a hand-maintained timezone
 * table, not a verified fact (see geo-mismatch-engine.ts).
 */
const SIGNAL_WEIGHTS: Record<RiskSignalType, number> = {
  'device-correlation': 30,
  velocity: 25,
  'disposable-phone': 20,
  'network-correlation': 15,
  'geo-mismatch': 10,
};

export interface RiskEngineInput {
  subject: string;
  correlation: RiskSignal;
  velocity: RiskSignal;
  /** Omitted when no phone number was part of this signal (e.g. a GitHub/Discord completion). */
  disposablePhone?: RiskSignal;
  /** Omitted when the client IP wasn't available to the ingestion route. */
  networkCorrelation?: RiskSignal;
  /** Omitted when there's no phone+timezone pair to compare (see geo-mismatch-engine.ts). */
  geoMismatch?: RiskSignal;
  now: number;
}

/**
 * Combines independent signals into a single aggregate risk score. Pure
 * function — no store access, no Human Score dependency. Computed and
 * stored (via `service.ts`) entirely separately from
 * `features/scoring/engine.ts`'s Human Score.
 */
export function computeRiskAssessment(input: RiskEngineInput): RiskAssessment {
  const signals = [
    input.correlation,
    input.velocity,
    input.disposablePhone,
    input.networkCorrelation,
    input.geoMismatch,
  ].filter((signal): signal is RiskSignal => signal !== undefined);

  const rawScore = signals.reduce((sum, signal) => sum + signal.score * SIGNAL_WEIGHTS[signal.type], 0);

  return {
    subject: input.subject,
    score: Math.round(Math.min(100, rawScore)),
    signals,
    computedAt: input.now,
  };
}
