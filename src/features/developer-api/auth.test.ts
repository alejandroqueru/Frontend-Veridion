import { describe, expect, it } from 'vitest';

import { issueApiKey } from './api-keys';
import { authenticate, extractApiKey } from './auth';

const SECRET = 'test-signing-secret';

function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe('extractApiKey', () => {
  it('reads a Bearer token', () => {
    expect(extractApiKey(headers({ authorization: 'Bearer vrd_abc' }))).toBe('vrd_abc');
  });
  it('reads the x-api-key header', () => {
    expect(extractApiKey(headers({ 'x-api-key': 'vrd_xyz' }))).toBe('vrd_xyz');
  });
  it('returns null when absent', () => {
    expect(extractApiKey(headers({}))).toBeNull();
  });
});

describe('authenticate', () => {
  const { key } = issueApiKey({ appName: 'Acme', scopes: ['read:status'] }, SECRET);
  const scopedKey = issueApiKey({ appName: 'Acme', scopes: ['read:status', 'read:score'] }, SECRET).key;

  it('rejects a missing key with 401', () => {
    const res = authenticate(headers({}), 'read:status', SECRET);
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects an invalid key with 401', () => {
    const res = authenticate(headers({ 'x-api-key': 'vrd_bad.sig' }), 'read:status', SECRET);
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects an insufficient scope with 403', () => {
    const res = authenticate(headers({ authorization: `Bearer ${key}` }), 'read:score', SECRET);
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it('accepts a valid, sufficiently-scoped key', () => {
    const res = authenticate(headers({ authorization: `Bearer ${scopedKey}` }), 'read:score', SECRET);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.claims.appName).toBe('Acme');
  });

  it('returns 500 when no signing secret is configured', () => {
    const previous = process.env.VERIDION_API_KEY_SECRET;
    delete process.env.VERIDION_API_KEY_SECRET;
    const res = authenticate(headers({ authorization: `Bearer ${key}` }), 'read:status');
    expect(res).toMatchObject({ ok: false, status: 500 });
    if (previous !== undefined) process.env.VERIDION_API_KEY_SECRET = previous;
  });
});
