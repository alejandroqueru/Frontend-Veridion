import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ALICE, BOB, clearAuthEnv, openTestSession, useTestSessionSecret } from '@/features/auth/__tests__/support';
import { resetSessionStore } from '@/features/auth/session-store';

import { middleware } from './middleware';

// Middleware is the pre-filter, not the whole story: it verifies the token
// cryptographically and checks the coarse role. Anything needing server state —
// revocation, subject matching — is the handler's job and is covered by the
// route tests.

function req(path: string, headers: Headers = new Headers()) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

beforeEach(() => {
  useTestSessionSecret();
  resetSessionStore();
});

afterEach(() => {
  clearAuthEnv();
  resetSessionStore();
});

describe('middleware — unprotected paths', () => {
  it('lets public routes through untouched', async () => {
    for (const path of ['/', '/dashboard', '/api/v1/verification-status', '/api/v1/auth/challenge']) {
      const res = await middleware(req(path));
      expect(res.status, path).toBe(200);
    }
  });

  it('does not intercept the developer-API key axis', async () => {
    // Third-party key auth is a separate mechanism with its own contract;
    // this platform must leave it alone.
    const res = await middleware(req('/api/v1/verification-status', new Headers({ 'x-api-key': 'vrd_whatever' })));
    expect(res.status).toBe(200);
  });
});

describe('middleware — protected paths', () => {
  const protectedPaths = ['/api/v1/consent', '/api/v1/auth/sessions', '/api/internal/risk-review'];

  it('rejects every protected path without a session', async () => {
    for (const path of protectedPaths) {
      const res = await middleware(req(path));
      expect(res.status, path).toBe(401);
    }
  });

  it('rejects a forged token', async () => {
    const headers = new Headers({ authorization: 'Bearer vsa_forged.signature' });
    expect((await middleware(req('/api/v1/consent', headers))).status).toBe(401);
  });

  it('does not accept a developer API key in place of a session', async () => {
    const headers = new Headers({ 'x-api-key': 'vrd_payload.signature' });
    expect((await middleware(req('/api/v1/consent', headers))).status).toBe(401);
  });

  it('admits a valid session to subject-scoped routes', async () => {
    const { headers } = await openTestSession(ALICE.publicKey());
    expect((await middleware(req('/api/v1/consent', headers))).status).toBe(200);
    expect((await middleware(req('/api/v1/auth/sessions', headers))).status).toBe(200);
  });

  it('covers nested paths under a protected prefix', async () => {
    const { headers } = await openTestSession(ALICE.publicKey());
    expect((await middleware(req('/api/v1/auth/sessions/some-family-id'))).status).toBe(401);
    expect((await middleware(req('/api/v1/auth/sessions/some-family-id', headers))).status).toBe(200);
  });

  it('enforces the reviewer role on the staff route', async () => {
    const plain = await openTestSession(BOB.publicKey());
    expect((await middleware(req('/api/internal/risk-review', plain.headers))).status).toBe(403);

    process.env.VERIDION_REVIEWER_ADDRESSES = ALICE.publicKey();
    const reviewer = await openTestSession(ALICE.publicKey());
    expect((await middleware(req('/api/internal/risk-review', reviewer.headers))).status).toBe(200);
  });

  it('fails closed when the signing secret is missing', async () => {
    const { headers } = await openTestSession(ALICE.publicKey());
    delete process.env.VERIDION_SESSION_SECRET;
    expect((await middleware(req('/api/v1/consent', headers))).status).toBe(500);
  });
});
