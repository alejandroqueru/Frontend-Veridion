import type StellarApiService from '@/features/verifications/services/stellar-api';
import type { SignalBundle } from './types';
import { buildSignalBundle } from './types';

const DAY_MS = 86_400_000;

// ── Stellar signal normalization ──────────────────────────────────────

export interface StellarRawSignalInput {
  transactionCount: number;
  /** ISO timestamp of the account's oldest known transaction, or null if unavailable. */
  accountCreatedAt: string | null;
  /** ISO timestamp of the most recent transaction, or null if the account has none. */
  lastTransactionAt: string | null;
  /** One entry per operation (duplicates expected); diversity is derived from distinct values. */
  operationTypes: string[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Pure: turns raw Horizon-derived data into four [0,1] signals. Takes `now`
 * explicitly and performs no I/O — callers freeze the resulting SignalBundle
 * into a VerificationEvent's rawPayload at verify-time, so replaying this
 * event under a future schema version never needs to re-fetch or re-normalize.
 */
export function normalizeStellarSignals(raw: StellarRawSignalInput, now: number): SignalBundle {
  // Log-scaled so ~100 transactions reaches full score, without a hardcoded tier table.
  const txVolumeTier = clamp01(Math.log10(raw.transactionCount + 1) / Math.log10(101));

  const accountAgeDays = raw.accountCreatedAt
    ? clamp01((now - new Date(raw.accountCreatedAt).getTime()) / DAY_MS / 365)
    : 0;

  const activityRecency = raw.lastTransactionAt
    ? clamp01(1 - (now - new Date(raw.lastTransactionAt).getTime()) / DAY_MS / 90)
    : 0;

  const distinctOperationTypes = new Set(raw.operationTypes).size;
  const operationDiversity = clamp01(distinctOperationTypes / 6);

  return buildSignalBundle({
    txVolumeTier,
    accountAgeDays,
    activityRecency,
    operationDiversity,
  });
}

// ── Fetch + normalize orchestration ────────────────────────────────────

export interface StellarFetchResult {
  signals: SignalBundle;
  raw: StellarRawSignalInput;
}

/**
 * Impure boundary: orchestrates the Horizon calls needed for scoring, then
 * hands the raw data to the pure normalizer. Nothing in the engine or
 * schema ever calls this — only verification UX components do, at
 * verify-time, freezing the result into a VerificationEvent's rawPayload.
 */
export async function fetchAndNormalizeStellarSignals(
  accountId: string,
  api: StellarApiService,
  now: number = Date.now(),
): Promise<StellarFetchResult> {
  const [transactionCount, accountCreatedAt, latestTransactions, operations] = await Promise.all([
    api.getTransactionCount(accountId),
    api.getAccountCreatedAt(accountId),
    api.getLatestTransactions(accountId, 1),
    api.getAccountOperations(accountId, 200),
  ]);

  const raw: StellarRawSignalInput = {
    transactionCount,
    accountCreatedAt,
    lastTransactionAt: latestTransactions[0]?.created_at ?? null,
    operationTypes: operations.map((op) => op.type),
  };

  return { signals: normalizeStellarSignals(raw, now), raw };
}
