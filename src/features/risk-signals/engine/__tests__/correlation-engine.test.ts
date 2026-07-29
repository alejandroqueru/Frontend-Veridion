import { describe, expect, it } from 'vitest';

import { computeCorrelationSignal, DEFAULT_CORRELATION_CONFIG } from '../correlation-engine';

describe('computeCorrelationSignal', () => {
  it('scores 0 when distinct accounts are within the normal threshold', () => {
    const signal = computeCorrelationSignal(['wallet-a', 'wallet-b']);
    expect(signal.type).toBe('device-correlation');
    expect(signal.score).toBe(0);
  });

  it('scores above 0 once distinct accounts exceed the threshold', () => {
    const many = Array.from(
      { length: DEFAULT_CORRELATION_CONFIG.maxDistinctSubjects + 2 },
      (_, i) => `wallet-${i}`,
    );
    const signal = computeCorrelationSignal(many);
    expect(signal.score).toBeGreaterThan(0);
  });

  it('caps the score at 1 no matter how many accounts share the device', () => {
    const many = Array.from({ length: 500 }, (_, i) => `wallet-${i}`);
    const signal = computeCorrelationSignal(many);
    expect(signal.score).toBe(1);
  });

  it('respects a custom config', () => {
    const signal = computeCorrelationSignal(['a', 'b', 'c'], { windowMs: 1000, maxDistinctSubjects: 1 });
    expect(signal.score).toBeGreaterThan(0);
  });

  it('scores exactly 0 right at the threshold (boundary is inclusive of normal usage)', () => {
    const atThreshold = Array.from({ length: DEFAULT_CORRELATION_CONFIG.maxDistinctSubjects }, (_, i) => `wallet-${i}`);
    expect(computeCorrelationSignal(atThreshold).score).toBe(0);
  });

  it('scores above 0 for exactly one account over the threshold', () => {
    const overByOne = Array.from(
      { length: DEFAULT_CORRELATION_CONFIG.maxDistinctSubjects + 1 },
      (_, i) => `wallet-${i}`,
    );
    expect(computeCorrelationSignal(overByOne).score).toBeGreaterThan(0);
  });
});
