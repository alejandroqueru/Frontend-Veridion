import { describe, expect, it } from 'vitest';

import {
  computeNetworkCorrelationSignal,
  DEFAULT_NETWORK_CORRELATION_CONFIG,
} from '../network-correlation-engine';

describe('computeNetworkCorrelationSignal', () => {
  it('scores 0 for a handful of accounts sharing one IP (plausible NAT/shared network)', () => {
    const signal = computeNetworkCorrelationSignal(['wallet-a', 'wallet-b', 'wallet-c']);
    expect(signal.type).toBe('network-correlation');
    expect(signal.score).toBe(0);
  });

  it('scores above 0 once distinct accounts exceed the (higher, noisier) IP threshold', () => {
    const many = Array.from(
      { length: DEFAULT_NETWORK_CORRELATION_CONFIG.maxDistinctSubjects + 3 },
      (_, i) => `wallet-${i}`,
    );
    expect(computeNetworkCorrelationSignal(many).score).toBeGreaterThan(0);
  });

  it('has a higher default threshold than device correlation (IP is a noisier signal)', () => {
    // Sanity-check the design rationale in the module doc comment stays true.
    expect(DEFAULT_NETWORK_CORRELATION_CONFIG.maxDistinctSubjects).toBeGreaterThan(3);
  });

  it('caps the score at 1', () => {
    const many = Array.from({ length: 1000 }, (_, i) => `wallet-${i}`);
    expect(computeNetworkCorrelationSignal(many).score).toBe(1);
  });
});
