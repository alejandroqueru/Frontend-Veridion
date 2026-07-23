import { describe, expect, it } from 'vitest';

import { hasScope, issueApiKey, verifyApiKey } from './api-keys';

const SECRET = 'test-signing-secret';

describe('api-keys', () => {
  it('round-trips issue → verify with intact claims', () => {
    const { key, claims } = issueApiKey({ appName: 'Acme', scopes: ['read:status'] }, SECRET);
    expect(key.startsWith('vrd_')).toBe(true);

    const result = verifyApiKey(key, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.appName).toBe('Acme');
      expect(result.claims.appId).toBe(claims.appId);
      expect(result.claims.scopes).toEqual(['read:status']);
    }
  });

  it('honors an explicit appId', () => {
    const { key } = issueApiKey({ appName: 'Acme', scopes: ['read:status'], appId: 'app-123' }, SECRET);
    const result = verifyApiKey(key, SECRET);
    expect(result.ok && result.claims.appId).toBe('app-123');
  });

  it('rejects a key signed with a different secret', () => {
    const { key } = issueApiKey({ appName: 'Acme', scopes: ['read:status'] }, SECRET);
    const result = verifyApiKey(key, 'other-secret');
    expect(result).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects a tampered payload', () => {
    const { key } = issueApiKey({ appName: 'Acme', scopes: ['read:status'] }, SECRET);
    // Flip a character in the payload segment.
    const [payload, sig] = key.slice('vrd_'.length).split('.');
    const tampered = `vrd_${payload.slice(0, -1)}${payload.at(-1) === 'A' ? 'B' : 'A'}.${sig}`;
    expect(verifyApiKey(tampered, SECRET).ok).toBe(false);
  });

  it('rejects malformed keys', () => {
    expect(verifyApiKey('not-a-key', SECRET)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyApiKey('vrd_onlypayload', SECRET)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyApiKey(null, SECRET)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('checks scopes', () => {
    const { claims } = issueApiKey({ appName: 'Acme', scopes: ['read:status'] }, SECRET);
    expect(hasScope(claims, 'read:status')).toBe(true);
    expect(hasScope(claims, 'read:score')).toBe(false);
  });
});
