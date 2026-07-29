import { describe, expect, it } from 'vitest';

import { computeGeoMismatchSignal, DEFAULT_GEO_MISMATCH_CONFIG } from '../geo-mismatch-engine';

// Peru: +51, plausible range [300, 300] (UTC-5, no DST).
const PERU_PHONE = '+51987654321';

describe('computeGeoMismatchSignal', () => {
  it('scores 0 when the browser timezone matches the phone calling code', () => {
    const signal = computeGeoMismatchSignal(PERU_PHONE, 300);
    expect(signal.type).toBe('geo-mismatch');
    expect(signal.score).toBe(0);
  });

  it('scores 1 when the browser timezone is far outside the plausible range for the calling code', () => {
    // -540 is Japan's offset — nowhere near Peru's.
    const signal = computeGeoMismatchSignal(PERU_PHONE, -540);
    expect(signal.score).toBe(1);
  });

  it('is inclusive of the tolerance boundary', () => {
    const edge = 300 + DEFAULT_GEO_MISMATCH_CONFIG.toleranceMinutes;
    expect(computeGeoMismatchSignal(PERU_PHONE, edge).score).toBe(0);
    expect(computeGeoMismatchSignal(PERU_PHONE, edge + 1).score).toBe(1);
  });

  it('is not evaluated (score 0) when the phone number is missing', () => {
    const signal = computeGeoMismatchSignal(undefined, 300);
    expect(signal.score).toBe(0);
    expect(signal.detail).toMatch(/not evaluated/i);
  });

  it('is not evaluated (score 0) when the browser timezone is missing', () => {
    const signal = computeGeoMismatchSignal(PERU_PHONE, undefined);
    expect(signal.score).toBe(0);
    expect(signal.detail).toMatch(/not evaluated/i);
  });

  it('is not evaluated (score 0) for a calling code outside the known-country table', () => {
    const signal = computeGeoMismatchSignal('+99812345678', 300);
    expect(signal.score).toBe(0);
    expect(signal.detail).toMatch(/not evaluated/i);
  });

  it('handles a multi-timezone country by accepting any offset within its full span', () => {
    // US: plausible range [240, 600] (Eastern DST .. Hawaii).
    expect(computeGeoMismatchSignal('+14155552671', 240).score).toBe(0);
    expect(computeGeoMismatchSignal('+14155552671', 600).score).toBe(0);
    expect(computeGeoMismatchSignal('+14155552671', 480).score).toBe(0);
  });

  it('matches the longest calling code first (Nigeria, 3 digits, not confused with a shorter prefix)', () => {
    // Nigeria: +234, plausible range [-60, -60].
    expect(computeGeoMismatchSignal('+2348012345678', -60).score).toBe(0);
  });
});
