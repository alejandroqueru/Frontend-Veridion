import { describe, expect, it } from 'vitest';

import { computeVelocitySignal, DEFAULT_VELOCITY_CONFIG } from '../velocity-engine';

const NOW = 1_700_000_000_000;

describe('computeVelocitySignal', () => {
  it('scores 0 for a normal, humanly-paced set of completions', () => {
    const timestamps = [NOW - 3 * 24 * 60 * 60 * 1000, NOW - 2 * 60 * 60 * 1000, NOW];
    const signal = computeVelocitySignal(timestamps, NOW);
    expect(signal.type).toBe('velocity');
    expect(signal.score).toBe(0);
  });

  it('flags more completions than plausible inside the velocity window', () => {
    const timestamps = Array.from(
      { length: DEFAULT_VELOCITY_CONFIG.maxCompletionsInWindow + 2 },
      (_, i) => NOW - i * 10_000,
    );
    const signal = computeVelocitySignal(timestamps, NOW);
    expect(signal.score).toBeGreaterThan(0);
  });

  it('flags back-to-back completions faster than plausible human interaction', () => {
    const signal = computeVelocitySignal([NOW - 500, NOW], NOW);
    expect(signal.score).toBeGreaterThan(0);
  });

  it('ignores completions outside the window entirely', () => {
    const signal = computeVelocitySignal([NOW - 999_000_000], NOW);
    expect(signal.score).toBe(0);
  });

  it('ignores future timestamps (defensive against clock skew)', () => {
    const signal = computeVelocitySignal([NOW + 60_000], NOW);
    expect(signal.score).toBe(0);
  });

  it('scores exactly 0 with exactly the max plausible completions and a plausible gap', () => {
    const timestamps = Array.from(
      { length: DEFAULT_VELOCITY_CONFIG.maxCompletionsInWindow },
      (_, i) => NOW - i * (DEFAULT_VELOCITY_CONFIG.minPlausibleGapMs + 1),
    );
    expect(computeVelocitySignal(timestamps, NOW).score).toBe(0);
  });

  it('scores exactly 0 with a gap exactly at the plausibility floor', () => {
    const signal = computeVelocitySignal([NOW - DEFAULT_VELOCITY_CONFIG.minPlausibleGapMs, NOW], NOW);
    expect(signal.score).toBe(0);
  });
});
