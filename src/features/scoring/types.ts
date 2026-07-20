// ── Verification events ─────────────────────────────────────────────

export type ProviderId = string;

export type VerificationCategory = 'social' | 'physical' | 'blockchain' | (string & {});

export type AlgorithmVersion = 'v1' | 'v2' | (string & {});

export type EventSource = 'live' | 'migrated-legacy';

/**
 * Append-only verification record. Re-verifying a provider pushes a NEW event
 * with a fresh eventId/occurredAt — existing events are never mutated or removed.
 */
export interface VerificationEvent {
  eventId: string;
  providerId: ProviderId;
  category: VerificationCategory;
  occurredAt: number;
  algorithmVersionAtCapture: AlgorithmVersion;
  rawPayload: unknown;
  source: EventSource;
}

export interface LegacyPointsPayload {
  legacyPoints: number;
}

export function hasLegacyPoints(payload: unknown): payload is LegacyPointsPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'legacyPoints' in payload &&
    typeof (payload as { legacyPoints: unknown }).legacyPoints === 'number'
  );
}

// ── Normalized signals ───────────────────────────────────────────────

export interface NormalizedSignal {
  key: string;
  /** Always in [0, 1] unless a normalizer's doc comment says otherwise. */
  value: number;
}

export type SignalBundle = NormalizedSignal[];

export function getSignal(bundle: SignalBundle | undefined, key: string): number | undefined {
  return bundle?.find((signal) => signal.key === key)?.value;
}

export function buildSignalBundle(values: Record<string, number>): SignalBundle {
  return Object.entries(values).map(([key, value]) => ({ key, value }));
}

// ── Scoring schema ───────────────────────────────────────────────────

export interface DecayPolicyNone {
  kind: 'none';
}

export interface DecayPolicyLinear {
  kind: 'linear';
  /** Weight reaches `floor` at 2x this many days, ramping linearly from there. */
  halfLifeDays: number;
  /** Minimum retained weight, never decays below this. Default 0.2. */
  floor?: number;
}

export interface DecayPolicyStep {
  kind: 'step';
  /** Ascending or unordered list of {afterDays, weight} thresholds. */
  steps: { afterDays: number; weight: number }[];
  floor?: number;
}

export type DecayPolicy = DecayPolicyNone | DecayPolicyLinear | DecayPolicyStep;

export type ScoreFromPayloadFn = (rawPayload: unknown, ctx: { baseWeight: number }) => number;

export interface ProviderConfig {
  id: ProviderId;
  category: VerificationCategory;
  label: string;
  /** Max points contributable at multiplier 1.0, before decay. */
  baseWeight: number;
  /**
   * Returns a [0,1] multiplier applied to baseWeight. Omit for simple
   * boolean-completion providers (full credit as soon as an event exists).
   */
  scoreFromSignals?: ScoreFromPayloadFn;
  decay: DecayPolicy;
}

export interface CategoryConfig {
  category: VerificationCategory;
  label: string;
  /** Max total points this category can contribute, even if providers sum higher. */
  cap: number;
}

export interface ScoringSchema {
  version: AlgorithmVersion;
  categories: CategoryConfig[];
  providers: Record<ProviderId, ProviderConfig>;
  /** Used for any providerId not present in `providers` — never throw on unknown ids. */
  fallbackProvider: ProviderConfig;
}

// ── Score explanation (engine output) ───────────────────────────────

export interface ProviderContribution {
  providerId: ProviderId;
  category: VerificationCategory;
  label: string;
  activeEventId: string;
  occurredAt: number;
  /** baseWeight * signal multiplier (or legacyPoints), before decay. */
  rawWeight: number;
  /** [0,1] multiplier from temporal decay. */
  decayFactor: number;
  /** rawWeight * decayFactor, before category-cap scaling. */
  contributedPoints: number;
  /** What actually counts toward the total, after category-cap scaling. */
  cappedPoints: number;
  isUnknownProvider: boolean;
  /** Total historical events for this provider (for the history/timeline UI). */
  eventCount: number;
}

export interface CategoryContribution {
  category: VerificationCategory;
  label: string;
  earnedPoints: number;
  cap: number;
  providers: ProviderContribution[];
}

export interface ScoreExplanation {
  algorithmVersion: AlgorithmVersion;
  computedAt: number;
  totalScore: number;
  categories: CategoryContribution[];
  /** Full, unfiltered event log — powers the history/timeline UI. */
  history: VerificationEvent[];
  warnings: string[];
}
