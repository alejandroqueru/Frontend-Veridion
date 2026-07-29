import { describe, expect, it } from 'vitest';

import { plausibleOffsetRangeForPhone } from '../calling-code-timezones';

describe('plausibleOffsetRangeForPhone', () => {
  it('returns the range for a known single-digit calling code', () => {
    expect(plausibleOffsetRangeForPhone('+14155552671')).toEqual([240, 600]);
  });

  it('returns the range for a known two-digit calling code', () => {
    expect(plausibleOffsetRangeForPhone('+34912345678')).toEqual([-120, -60]);
  });

  it('matches the longest calling code first, not a shorter numeric prefix', () => {
    // Nigeria is +234 (three digits) — a naive shortest/first match could
    // wrongly stop at a hypothetical shorter code sharing the leading '2'.
    expect(plausibleOffsetRangeForPhone('+2348012345678')).toEqual([-60, -60]);
  });

  it('returns null for a calling code not in the table', () => {
    expect(plausibleOffsetRangeForPhone('+99812345678')).toBeNull();
  });

  it('works whether or not the leading + is present', () => {
    expect(plausibleOffsetRangeForPhone('51987654321')).toEqual([300, 300]);
  });
});
