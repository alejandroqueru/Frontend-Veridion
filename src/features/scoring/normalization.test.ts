import { vi } from 'vitest';
import StellarApiService from '@/features/verifications/services/stellar-api';
import { normalizeStellarSignals, fetchAndNormalizeStellarSignals, type StellarRawSignalInput } from './normalization';
import { getSignal } from './types';

const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();
const DAY_MS = 86_400_000;

describe('normalizeStellarSignals', () => {
  it('produces all-zero signals for an account with no activity', () => {
    const raw: StellarRawSignalInput = {
      transactionCount: 0,
      accountCreatedAt: null,
      lastTransactionAt: null,
      operationTypes: [],
    };
    const bundle = normalizeStellarSignals(raw, NOW);
    expect(getSignal(bundle, 'txVolumeTier')).toBe(0);
    expect(getSignal(bundle, 'accountAgeDays')).toBe(0);
    expect(getSignal(bundle, 'activityRecency')).toBe(0);
    expect(getSignal(bundle, 'operationDiversity')).toBe(0);
  });

  it('keeps every signal within [0,1] for an extreme high-activity account', () => {
    const raw: StellarRawSignalInput = {
      transactionCount: 100_000,
      accountCreatedAt: new Date(NOW - 5000 * DAY_MS).toISOString(),
      lastTransactionAt: new Date(NOW).toISOString(),
      operationTypes: Array.from({ length: 50 }, (_, i) => `type_${i % 10}`),
    };
    const bundle = normalizeStellarSignals(raw, NOW);
    for (const signal of bundle) {
      expect(signal.value).toBeGreaterThanOrEqual(0);
      expect(signal.value).toBeLessThanOrEqual(1);
    }
  });

  it('produces materially different scores for an old/active/diverse account vs a new/dormant/single-op one', () => {
    const richAccount: StellarRawSignalInput = {
      transactionCount: 150,
      accountCreatedAt: new Date(NOW - 400 * DAY_MS).toISOString(),
      lastTransactionAt: new Date(NOW - 1 * DAY_MS).toISOString(),
      operationTypes: ['payment', 'create_account', 'change_trust', 'manage_offer', 'path_payment', 'payment'],
    };
    const thinAccount: StellarRawSignalInput = {
      transactionCount: 1,
      accountCreatedAt: new Date(NOW - 2 * DAY_MS).toISOString(),
      lastTransactionAt: new Date(NOW - 89 * DAY_MS).toISOString(),
      operationTypes: ['payment'],
    };

    const rich = normalizeStellarSignals(richAccount, NOW);
    const thin = normalizeStellarSignals(thinAccount, NOW);

    expect(getSignal(rich, 'txVolumeTier')!).toBeGreaterThan(getSignal(thin, 'txVolumeTier')!);
    expect(getSignal(rich, 'accountAgeDays')!).toBeGreaterThan(getSignal(thin, 'accountAgeDays')!);
    expect(getSignal(rich, 'operationDiversity')!).toBeGreaterThan(getSignal(thin, 'operationDiversity')!);
  });

  it('decays activityRecency toward 0 as the last transaction ages past ~90 days', () => {
    const raw: StellarRawSignalInput = {
      transactionCount: 10,
      accountCreatedAt: new Date(NOW - 100 * DAY_MS).toISOString(),
      lastTransactionAt: new Date(NOW - 200 * DAY_MS).toISOString(),
      operationTypes: ['payment'],
    };
    expect(getSignal(normalizeStellarSignals(raw, NOW), 'activityRecency')).toBe(0);
  });

  it('caps operationDiversity at 1 once 6+ distinct types are seen', () => {
    const raw: StellarRawSignalInput = {
      transactionCount: 10,
      accountCreatedAt: new Date(NOW - 10 * DAY_MS).toISOString(),
      lastTransactionAt: new Date(NOW).toISOString(),
      operationTypes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    };
    expect(getSignal(normalizeStellarSignals(raw, NOW), 'operationDiversity')).toBe(1);
  });
});

describe('fetchAndNormalizeStellarSignals', () => {
  it('orchestrates the Horizon calls in parallel and normalizes the combined result', async () => {
    const api = new StellarApiService();
    vi.spyOn(api, 'getTransactionCount').mockResolvedValue(42);
    vi.spyOn(api, 'getAccountCreatedAt').mockResolvedValue('2025-01-01T00:00:00.000Z');
    vi.spyOn(api, 'getLatestTransactions').mockResolvedValue([
      {
        id: '1',
        hash: 'h1',
        created_at: '2026-01-01T00:00:00.000Z',
        fee_charged: '100',
        operation_count: 1,
        successful: true,
        source_account: 'GABC',
      },
    ]);
    vi.spyOn(api, 'getAccountOperations').mockResolvedValue([
      { id: 'o1', type: 'payment', created_at: '2026-01-01T00:00:00.000Z', transaction_hash: 'h1', source_account: 'GABC' },
      {
        id: 'o2',
        type: 'create_account',
        created_at: '2026-01-01T00:00:00.000Z',
        transaction_hash: 'h1',
        source_account: 'GABC',
      },
      { id: 'o3', type: 'payment', created_at: '2026-01-01T00:00:00.000Z', transaction_hash: 'h1', source_account: 'GABC' },
    ]);

    const now = new Date('2026-01-02T00:00:00.000Z').getTime();
    const result = await fetchAndNormalizeStellarSignals('GABC', api, now);

    expect(api.getAccountOperations).toHaveBeenCalledWith('GABC', 200);
    expect(result.raw.transactionCount).toBe(42);
    expect(result.raw.accountCreatedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.raw.lastTransactionAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.raw.operationTypes).toEqual(['payment', 'create_account', 'payment']);

    expect(result.signals).toHaveLength(4);
    expect(getSignal(result.signals, 'operationDiversity')).toBeCloseTo(2 / 6, 5);
  });

  it('handles an account with no transactions gracefully', async () => {
    const api = new StellarApiService();
    vi.spyOn(api, 'getTransactionCount').mockResolvedValue(0);
    vi.spyOn(api, 'getAccountCreatedAt').mockResolvedValue(null);
    vi.spyOn(api, 'getLatestTransactions').mockResolvedValue([]);
    vi.spyOn(api, 'getAccountOperations').mockResolvedValue([]);

    const result = await fetchAndNormalizeStellarSignals('GABC', api, Date.now());

    expect(result.raw.lastTransactionAt).toBeNull();
    expect(result.signals.every((s) => s.value === 0)).toBe(true);
  });
});
