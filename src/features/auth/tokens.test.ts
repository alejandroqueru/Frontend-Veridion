import { describe, expect, it } from 'vitest';

import {
  ACCESS_TOKEN_TTL_MS,
  hashToken,
  issueAccessToken,
  issueRefreshToken,
  parseRefreshToken,
  verifyAccessToken,
} from './tokens';

const SECRET = 'test-session-secret';
const ADDRESS = `G${'A'.repeat(55)}`;

function input(overrides: Partial<Parameters<typeof issueAccessToken>[0]> = {}) {
  return { address: ADDRESS, roles: ['subject' as const], familyId: 'fam-1', ...overrides };
}

describe('access tokens', () => {
  it('round-trips issue → verify with intact claims', async () => {
    const token = await issueAccessToken(input({ roles: ['subject', 'reviewer'] }), SECRET);
    expect(token.startsWith('vsa_')).toBe(true);

    const result = await verifyAccessToken(token, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe(ADDRESS);
      expect(result.claims.roles).toEqual(['subject', 'reviewer']);
      expect(result.claims.fid).toBe('fam-1');
    }
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await issueAccessToken(input(), SECRET);
    expect(await verifyAccessToken(token, 'other-secret')).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects a tampered payload', async () => {
    const token = await issueAccessToken(input(), SECRET);
    const [payload, signature] = token.slice('vsa_'.length).split('.');
    const tampered = `vsa_${payload.slice(0, -1)}${payload.at(-1) === 'A' ? 'B' : 'A'}.${signature}`;
    expect((await verifyAccessToken(tampered, SECRET)).ok).toBe(false);
  });

  it('rejects malformed tokens', async () => {
    expect(await verifyAccessToken('not-a-token', SECRET)).toEqual({ ok: false, reason: 'malformed' });
    expect(await verifyAccessToken('vsa_onlypayload', SECRET)).toEqual({ ok: false, reason: 'malformed' });
    expect(await verifyAccessToken(null, SECRET)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('does not accept a developer API key as a session token', async () => {
    // The two authentication axes must not cross: a `vrd_` key is not a person.
    expect((await verifyAccessToken('vrd_payload.signature', SECRET)).ok).toBe(false);
  });

  it('expires after its TTL', async () => {
    const now = Date.now();
    const token = await issueAccessToken(input({ now }), SECRET);

    expect((await verifyAccessToken(token, SECRET, now + ACCESS_TOKEN_TTL_MS - 1)).ok).toBe(true);
    expect(await verifyAccessToken(token, SECRET, now + ACCESS_TOKEN_TTL_MS)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
});

describe('refresh tokens', () => {
  it('carries its family id and a random secret half', () => {
    const first = issueRefreshToken('fam-1');
    const second = issueRefreshToken('fam-1');

    expect(parseRefreshToken(first)).toEqual({ familyId: 'fam-1' });
    expect(first).not.toBe(second);
  });

  it('rejects malformed refresh tokens', () => {
    expect(parseRefreshToken('nope')).toBeNull();
    expect(parseRefreshToken('vsr_no-secret-half')).toBeNull();
    expect(parseRefreshToken(null)).toBeNull();
  });

  it('hashes stably and differently per token', async () => {
    const token = issueRefreshToken('fam-1');
    expect(await hashToken(token)).toBe(await hashToken(token));
    expect(await hashToken(token)).not.toBe(await hashToken(issueRefreshToken('fam-1')));
  });
});
