// @vitest-environment jsdom
// getDeviceFingerprint/getTimezoneOffsetMinutes both branch on `typeof
// window`, so they need a DOM global to exercise their real logic rather
// than their SSR-safe no-op path.

import { beforeEach, describe, expect, it } from 'vitest';

import { getDeviceFingerprint, getTimezoneOffsetMinutes } from '../fingerprint';

describe('getTimezoneOffsetMinutes', () => {
  it('returns a number within the real-world UTC offset range', () => {
    const offset = getTimezoneOffsetMinutes();
    expect(typeof offset).toBe('number');
    expect(Math.abs(offset as number)).toBeLessThanOrEqual(840);
  });
});

describe('getDeviceFingerprint', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('returns a 64-char lowercase hex hash', async () => {
    const fingerprint = await getDeviceFingerprint();
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is stable across repeated calls in the same session (cached)', async () => {
    const first = await getDeviceFingerprint();
    const second = await getDeviceFingerprint();
    expect(second).toBe(first);
  });

  it('caches the result in sessionStorage', async () => {
    const fingerprint = await getDeviceFingerprint();
    expect(window.sessionStorage.getItem('veridion-device-signal')).toBe(fingerprint);
  });

  it('still returns a valid hash if sessionStorage is unavailable', async () => {
    const original = window.sessionStorage.getItem;
    // Simulate a private-mode browser throwing on storage access.
    window.sessionStorage.getItem = () => {
      throw new Error('storage disabled');
    };
    try {
      const fingerprint = await getDeviceFingerprint();
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      window.sessionStorage.getItem = original;
    }
  });
});
