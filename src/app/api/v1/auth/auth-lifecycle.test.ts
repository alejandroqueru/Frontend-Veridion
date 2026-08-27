import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ALICE, BOB, clearAuthEnv, useTestSessionSecret } from '@/features/auth/__tests__/support';
import { getAuthAuditSink, resetAuthAuditSink } from '@/features/auth/audit';
import { resetChallengeStore } from '@/features/auth/challenge-store';
import { resetSessionStore } from '@/features/auth/session-store';
import type { AuthEventType } from '@/features/auth/types';

import { POST as challenge } from './challenge/route';
import { POST as refresh } from './refresh/route';
import { DELETE as revokeOne } from './sessions/[familyId]/route';
import { DELETE as signOutEverywhere, GET as listSessions } from './sessions/route';
import { POST as verify } from './verify/route';

// End-to-end exercise of the session lifecycle through the real route handlers:
// challenge → sign → verify → refresh → rotate → device management → sign-out.

interface Tokens {
  address: string;
  accessToken: string;
  refreshToken: string;
  familyId: string;
}

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as never;
}

function bearer(token: string): Headers {
  return new Headers({ authorization: `Bearer ${token}` });
}

/** Walk the real challenge → sign → verify flow, as a wallet would. */
async function signIn(keypair = ALICE, device = 'vitest-browser'): Promise<Tokens> {
  const challengeRes = await challenge(
    post('http://localhost/api/v1/auth/challenge', { address: keypair.publicKey() }),
  );
  expect(challengeRes.status).toBe(200);
  const { message } = await challengeRes.json();

  const signature = keypair.sign(Buffer.from(message, 'utf8')).toString('base64');
  const verifyRes = await verify(
    post(
      'http://localhost/api/v1/auth/verify',
      { address: keypair.publicKey(), signature },
      { 'user-agent': device },
    ),
  );
  expect(verifyRes.status).toBe(200);

  return (await verifyRes.json()) as Tokens;
}

async function auditTypes(): Promise<AuthEventType[]> {
  return (await getAuthAuditSink().list()).map((event) => event.type);
}

beforeEach(() => {
  useTestSessionSecret();
  resetChallengeStore();
  resetSessionStore();
  resetAuthAuditSink();
});

afterEach(() => {
  clearAuthEnv();
  resetChallengeStore();
  resetSessionStore();
  resetAuthAuditSink();
});

describe('challenge → verify', () => {
  it('opens a session for a correctly signed challenge', async () => {
    const session = await signIn();

    expect(session.address).toBe(ALICE.publicKey());
    expect(session.accessToken.startsWith('vsa_')).toBe(true);
    expect(session.refreshToken.startsWith('vsr_')).toBe(true);
  });

  it('rejects a signature from a different key', async () => {
    const challengeRes = await challenge(
      post('http://localhost/api/v1/auth/challenge', { address: ALICE.publicKey() }),
    );
    const { message } = await challengeRes.json();

    // MALLORY signs ALICE's challenge and presents it as ALICE.
    const forged = BOB.sign(Buffer.from(message, 'utf8')).toString('base64');
    const res = await verify(
      post('http://localhost/api/v1/auth/verify', { address: ALICE.publicKey(), signature: forged }),
    );

    expect(res.status).toBe(401);
    expect(await auditTypes()).toContain('auth.verify.failed');
  });

  it('rejects a replayed challenge', async () => {
    const challengeRes = await challenge(
      post('http://localhost/api/v1/auth/challenge', { address: ALICE.publicKey() }),
    );
    const { message } = await challengeRes.json();
    const signature = ALICE.sign(Buffer.from(message, 'utf8')).toString('base64');

    const body = { address: ALICE.publicKey(), signature };
    expect((await verify(post('http://localhost/api/v1/auth/verify', body))).status).toBe(200);
    // The challenge was consumed; the same signature is worthless now.
    expect((await verify(post('http://localhost/api/v1/auth/verify', body))).status).toBe(401);
  });

  it('rejects verification with no live challenge at all', async () => {
    const res = await verify(
      post('http://localhost/api/v1/auth/verify', {
        address: ALICE.publicKey(),
        signature: ALICE.sign(Buffer.from('anything', 'utf8')).toString('base64'),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('validates its input', async () => {
    expect((await challenge(post('http://localhost/api/v1/auth/challenge', { address: 'nope' }))).status).toBe(400);
    expect(
      (await verify(post('http://localhost/api/v1/auth/verify', { address: ALICE.publicKey() }))).status,
    ).toBe(400);
  });
});

describe('refresh rotation', () => {
  it('rotates the refresh token on every use', async () => {
    const session = await signIn();

    const res = await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: session.refreshToken }));
    expect(res.status).toBe(200);

    const rotated = (await res.json()) as Tokens;
    expect(rotated.refreshToken).not.toBe(session.refreshToken);
    expect(rotated.familyId).toBe(session.familyId);
  });

  it('revokes the whole family when a rotated-out token is reused', async () => {
    const session = await signIn();
    const first = (await (
      await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: session.refreshToken }))
    ).json()) as Tokens;

    // Replaying the superseded token trips reuse detection.
    const reuse = await refresh(
      post('http://localhost/api/v1/auth/refresh', { refreshToken: session.refreshToken }),
    );
    expect(reuse.status).toBe(401);

    // And the token the legitimate client had moved on to is dead as well.
    const after = await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: first.refreshToken }));
    expect(after.status).toBe(401);

    const events = await auditTypes();
    expect(events).toContain('auth.refresh.reuse-detected');
    expect(events).toContain('auth.session.revoked');
  });

  it('reports every failure identically', async () => {
    const unknown = await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: 'vsr_nope.abc' }));
    expect(unknown.status).toBe(401);
    expect((await unknown.json()).error).toBe('Session could not be refreshed. Sign in again.');
  });
});

describe('device management', () => {
  it('lists one family per signed-in device and marks the current one', async () => {
    const laptop = await signIn(ALICE, 'laptop');
    await signIn(ALICE, 'phone');

    const body = await (await listSessions(new Request('http://localhost/api/v1/auth/sessions', {
      headers: bearer(laptop.accessToken),
    }) as never)).json();

    expect(body.sessions).toHaveLength(2);
    expect(body.sessions.map((s: { device: string }) => s.device).sort()).toEqual(['laptop', 'phone']);
    expect(body.sessions.find((s: { current: boolean }) => s.current).familyId).toBe(laptop.familyId);
  });

  it('revokes one device and leaves the others signed in', async () => {
    const laptop = await signIn(ALICE, 'laptop');
    const phone = await signIn(ALICE, 'phone');

    const res = await revokeOne(
      new Request(`http://localhost/api/v1/auth/sessions/${phone.familyId}`, {
        method: 'DELETE',
        headers: bearer(laptop.accessToken),
      }) as never,
      { params: Promise.resolve({ familyId: phone.familyId }) },
    );
    expect(res.status).toBe(200);

    // The revoked device can no longer refresh...
    expect(
      (await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: phone.refreshToken }))).status,
    ).toBe(401);
    // ...while the one that did the revoking is unaffected.
    expect(
      (await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: laptop.refreshToken }))).status,
    ).toBe(200);
  });

  it('will not let one address revoke another address’s device', async () => {
    const alice = await signIn(ALICE, 'laptop');
    const bob = await signIn(BOB, 'laptop');

    const res = await revokeOne(
      new Request(`http://localhost/api/v1/auth/sessions/${bob.familyId}`, {
        method: 'DELETE',
        headers: bearer(alice.accessToken),
      }) as never,
      { params: Promise.resolve({ familyId: bob.familyId }) },
    );

    // 404, not 403: confirming the id exists would itself leak something.
    expect(res.status).toBe(404);
    expect(
      (await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: bob.refreshToken }))).status,
    ).toBe(200);
  });

  it('signs out everywhere for one address only', async () => {
    const laptop = await signIn(ALICE, 'laptop');
    const phone = await signIn(ALICE, 'phone');
    const bob = await signIn(BOB, 'laptop');

    const res = await signOutEverywhere(
      new Request('http://localhost/api/v1/auth/sessions', {
        method: 'DELETE',
        headers: bearer(laptop.accessToken),
      }) as never,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).revoked).toBe(2);

    for (const token of [laptop.refreshToken, phone.refreshToken]) {
      expect((await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: token }))).status).toBe(401);
    }
    expect(
      (await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: bob.refreshToken }))).status,
    ).toBe(200);
  });

  it('requires a session to list devices', async () => {
    const res = await listSessions(new Request('http://localhost/api/v1/auth/sessions') as never);
    expect(res.status).toBe(401);
  });
});

describe('audit trail', () => {
  it('records every lifecycle event', async () => {
    const session = await signIn();
    await refresh(post('http://localhost/api/v1/auth/refresh', { refreshToken: session.refreshToken }));
    await signOutEverywhere(
      new Request('http://localhost/api/v1/auth/sessions', {
        method: 'DELETE',
        headers: bearer(session.accessToken),
      }) as never,
    );

    expect(await auditTypes()).toEqual([
      'auth.challenge.issued',
      'auth.verify.succeeded',
      'auth.refresh.succeeded',
      'auth.session.revoked',
    ]);
  });

  it('never records a token or signature', async () => {
    const session = await signIn();
    const serialized = JSON.stringify(await getAuthAuditSink().list());

    expect(serialized).not.toContain(session.accessToken);
    expect(serialized).not.toContain(session.refreshToken);
  });
});
