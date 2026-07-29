import { describe, expect, it } from 'vitest';

import { isDisposablePhoneNumber } from '../disposable-phone-patterns';

describe('isDisposablePhoneNumber', () => {
  it('flags NANP toll-free numbers', () => {
    expect(isDisposablePhoneNumber('+18005551234')).toBe(true);
    expect(isDisposablePhoneNumber('+18885550100')).toBe(true);
  });

  it('flags NANP fictional-reserved 555-01xx numbers', () => {
    expect(isDisposablePhoneNumber('+12125550142')).toBe(true);
  });

  it('flags repeated-digit numbers', () => {
    expect(isDisposablePhoneNumber('+15555555555')).toBe(true);
  });

  it('flags sequential-digit numbers', () => {
    expect(isDisposablePhoneNumber('+11234567890')).toBe(true);
  });

  it('does not flag a plausible real-looking number', () => {
    expect(isDisposablePhoneNumber('+14158479213')).toBe(false);
  });

  it('does not flag a plausible non-NANP number', () => {
    expect(isDisposablePhoneNumber('+34912345678')).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    expect(isDisposablePhoneNumber('not-a-phone')).toBe(false);
    expect(isDisposablePhoneNumber('')).toBe(false);
  });
});
