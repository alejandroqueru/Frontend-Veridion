import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSession,
  getSessionStore,
  resetSessionStore,
  rotateRefreshToken,
} from './session-store';
import { REFRESH_TOKEN_TTL_MS, hashToken } from './tokens';

const ALICE = `G${'A'.repeat(55)}`;
const BOB = `G${'B'.repeat(55)}`;

beforeEach(() => resetSessionStore());
afterEach(() => resetSessionStore());

describe('createSession', () => {
  it('stores only the hash of the refresh token, never the token itself', async () => {
    const { family, refreshToken } = await createSession(ALICE, ['subject'], 'Firefox on macOS');

    expect(family.currentRefreshTokenHash).toBe(await hashToken(refreshToken));
    expect(JSON.stringify(family)).not.toContain(refreshToken);
  });

  it('records the device fingerprint and roles', async () => {
    const { family } = await createSession(ALICE, ['subject', 'reviewer'], 'Firefox on macOS');
    expect(family.device).toBe('Firefox on macOS');
    expect(family.roles).toEqual(['subject', 'reviewer']);
  });

  it('opens an independent family per device', async () => {
    await createSession(ALICE, ['subject'], 'laptop');
    await createSession(ALICE, ['subject'], 'phone');

    const families = await getSessionStore().listForAddress(ALICE);
    expect(families).toHaveLength(2);
    expect(new Set(families.map((f) => f.familyId)).size).toBe(2);
  });
});

describe('rotateRefreshToken', () => {
  it('issues a new token and invalidates the presented one', async () => {
    const { refreshToken } = await createSession(ALICE, ['subject'], 'laptop');

    const rotated = await rotateRefreshToken(refreshToken);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    expect(rotated.refreshToken).not.toBe(refreshToken);
    expect(rotated.family.currentRefreshTokenHash).toBe(await hashToken(rotated.refreshToken));
  });

  it('accepts the newly issued token on the next rotation', async () => {
    const { refreshToken } = await createSession(ALICE, ['subject'], 'laptop');
    const first = await rotateRefreshToken(refreshToken);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect((await rotateRefreshToken(first.refreshToken)).ok).toBe(true);
  });

  it('revokes the entire family when a rotated-out token is presented again', async () => {
    const { family, refreshToken } = await createSession(ALICE, ['subject'], 'laptop');
    const rotated = await rotateRefreshToken(refreshToken);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    // Replaying the superseded token is treated as compromise.
    const reuse = await rotateRefreshToken(refreshToken);
    expect(reuse).toMatchObject({ ok: false, reason: 'reuse-detected' });

    // Not just that token — the whole family is gone, so the token the
    // attacker (or the client) rotated to is dead too.
    expect(await getSessionStore().get(family.familyId)).toBeNull();
    expect(await rotateRefreshToken(rotated.refreshToken)).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('leaves other families untouched when one is revoked for reuse', async () => {
    const laptop = await createSession(ALICE, ['subject'], 'laptop');
    const phone = await createSession(ALICE, ['subject'], 'phone');
    await rotateRefreshToken(laptop.refreshToken);
    await rotateRefreshToken(laptop.refreshToken);

    expect(await getSessionStore().get(phone.family.familyId)).not.toBeNull();
  });

  it('rejects an unparseable or unknown token without revoking anything', async () => {
    const { family } = await createSession(ALICE, ['subject'], 'laptop');

    expect(await rotateRefreshToken('garbage')).toEqual({ ok: false, reason: 'unknown' });
    expect(await rotateRefreshToken('vsr_no-such-family.abc')).toEqual({ ok: false, reason: 'unknown' });
    expect(await getSessionStore().get(family.familyId)).not.toBeNull();
  });

  it('expires a family that has gone unused past the refresh TTL', async () => {
    const now = Date.now();
    const { family, refreshToken } = await createSession(ALICE, ['subject'], 'laptop', now);

    const result = await rotateRefreshToken(refreshToken, now + REFRESH_TOKEN_TTL_MS);
    expect(result).toMatchObject({ ok: false, reason: 'expired' });
    expect(await getSessionStore().get(family.familyId)).toBeNull();
  });
});

describe('revocation', () => {
  it('revokes a single device without touching the others', async () => {
    const laptop = await createSession(ALICE, ['subject'], 'laptop');
    const phone = await createSession(ALICE, ['subject'], 'phone');

    await getSessionStore().delete(laptop.family.familyId);

    expect(await getSessionStore().get(laptop.family.familyId)).toBeNull();
    expect(await getSessionStore().get(phone.family.familyId)).not.toBeNull();
  });

  it('signs out everywhere for one address only', async () => {
    await createSession(ALICE, ['subject'], 'laptop');
    await createSession(ALICE, ['subject'], 'phone');
    const bob = await createSession(BOB, ['subject'], 'laptop');

    expect(await getSessionStore().deleteForAddress(ALICE)).toBe(2);
    expect(await getSessionStore().listForAddress(ALICE)).toEqual([]);
    expect(await getSessionStore().get(bob.family.familyId)).not.toBeNull();
  });
});
