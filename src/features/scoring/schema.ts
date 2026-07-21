import type { AlgorithmVersion, ScoringSchema, SignalBundle } from './types';
import { getSignal } from './types';

const NONE = { kind: 'none' as const };

// ── v1: baseline schema ─────────────────────────────────────────────
/**
 * Reproduces today's hardcoded point values and tiering exactly, so
 * migrated legacy events and historical v1-tagged events recompute to the
 * same totals users saw before this engine existed. See
 * `constants/social-verifications.ts`, `physical-verifications.ts`, and
 * `blockchain-verifications.ts` in the verifications feature for the
 * source-of-truth values this mirrors (guarded by schema.test.ts).
 */

/** Mirrors stellar-api.ts's old calculatePoints(count) tier table, as a [0,1] multiplier. */
function legacyStellarMultiplier(rawPayload: unknown): number {
  const txCount =
    typeof rawPayload === 'object' && rawPayload !== null && 'txCount' in rawPayload
      ? Number((rawPayload as { txCount: unknown }).txCount)
      : 0;

  if (txCount >= 100) return 1; // 50 pts
  if (txCount >= 50) return 0.5; // 25 pts
  if (txCount >= 25) return 0.3; // 15 pts
  if (txCount >= 10) return 0.2; // 10 pts
  if (txCount >= 5) return 0.1; // 5 pts
  if (txCount >= 1) return 0.02; // 1 pt
  return 0;
}

export const SCHEMA_V1: ScoringSchema = {
  version: 'v1',
  categories: [
    { category: 'social', label: 'Social', cap: 24 },
    { category: 'physical', label: 'Physical', cap: 5500 },
    { category: 'blockchain', label: 'Blockchain', cap: 50 },
  ],
  providers: {
    google: { id: 'google', category: 'social', label: 'Google', baseWeight: 6, decay: NONE },
    discord: { id: 'discord', category: 'social', label: 'Discord', baseWeight: 6, decay: NONE },
    github: { id: 'github', category: 'social', label: 'GitHub', baseWeight: 6, decay: NONE },
    linkedin: { id: 'linkedin', category: 'social', label: 'LinkedIn', baseWeight: 6, decay: NONE },
    'government-id': {
      id: 'government-id',
      category: 'physical',
      label: 'Government ID',
      baseWeight: 1000,
      decay: NONE,
    },
    binance: { id: 'binance', category: 'physical', label: 'Binance', baseWeight: 1000, decay: NONE },
    'phone-verification': {
      id: 'phone-verification',
      category: 'physical',
      label: 'Phone Verification',
      baseWeight: 1000,
      decay: NONE,
    },
    'email-verification': {
      id: 'email-verification',
      category: 'physical',
      label: 'Email Verification',
      baseWeight: 500,
      decay: NONE,
    },
    biometrics: { id: 'biometrics', category: 'physical', label: 'Biometrics', baseWeight: 1000, decay: NONE },
    'proof-clean-hands': {
      id: 'proof-clean-hands',
      category: 'physical',
      label: 'Proof of Clean Hands',
      baseWeight: 1000,
      decay: NONE,
    },
    'stellar-transactions': {
      id: 'stellar-transactions',
      category: 'blockchain',
      label: 'Stellar Transactions',
      baseWeight: 50,
      decay: NONE,
      scoreFromSignals: legacyStellarMultiplier,
    },
  },
  fallbackProvider: {
    id: '__unknown__',
    category: 'unknown',
    label: 'Unknown provider',
    baseWeight: 0,
    decay: NONE,
  },
};

// ── v2: normalized Stellar signal scoring ───────────────────────────
/**
 * Single source of truth for how much each Stellar signal counts toward the
 * multiplier — exported so the verification UI can render a genuinely
 * schema-driven breakdown instead of a hand-copied tier table. Weights sum
 * to 1 so a maximally old/active/diverse/high-volume account reaches full
 * baseWeight.
 */
export const STELLAR_SIGNAL_WEIGHTS: Record<string, number> = {
  txVolumeTier: 0.35,
  accountAgeDays: 0.25,
  activityRecency: 0.15,
  operationDiversity: 0.25,
};

/**
 * Blends the four normalized Stellar signals using STELLAR_SIGNAL_WEIGHTS.
 * Falls back to 0 for payloads without a signal bundle (e.g. a stray
 * boolean-style event) rather than throwing.
 */
function stellarSignalMultiplier(rawPayload: unknown): number {
  const bundle =
    typeof rawPayload === 'object' && rawPayload !== null && 'signals' in rawPayload
      ? ((rawPayload as { signals: unknown }).signals as SignalBundle | undefined)
      : undefined;

  if (!bundle) return 0;

  return Object.entries(STELLAR_SIGNAL_WEIGHTS).reduce(
    (total, [key, weight]) => total + weight * (getSignal(bundle, key) ?? 0),
    0,
  );
}

/**
 * Same providers as v1, but `stellar-transactions` scores from real
 * normalized signals (not a fixed tx-count tier) and decays — an on-chain
 * activity signal should feel fresher near verification time, encouraging
 * cheap, self-serve re-verification. Adding a new provider here requires no
 * engine changes, only a new entry in `providers`.
 */
export const SCHEMA_V2: ScoringSchema = {
  ...SCHEMA_V1,
  version: 'v2',
  providers: {
    ...SCHEMA_V1.providers,
    'stellar-transactions': {
      id: 'stellar-transactions',
      category: 'blockchain',
      label: 'Stellar Transactions',
      baseWeight: 50,
      decay: { kind: 'linear', halfLifeDays: 60, floor: 0.3 },
      scoreFromSignals: stellarSignalMultiplier,
    },
  },
  fallbackProvider: { ...SCHEMA_V1.fallbackProvider },
};

// ── Version registry ────────────────────────────────────────────────

/** Single source of truth for "the current version" — nothing else hardcodes it. */
export const CURRENT_ALGORITHM_VERSION: AlgorithmVersion = 'v2';

export const SCHEMA_VERSIONS: Record<string, ScoringSchema> = {
  v1: SCHEMA_V1,
  v2: SCHEMA_V2,
};

/** Falls back to the current version for unrecognized/future version strings — never throws. */
export function getSchema(version: AlgorithmVersion): ScoringSchema {
  return SCHEMA_VERSIONS[version] ?? SCHEMA_VERSIONS[CURRENT_ALGORITHM_VERSION];
}
