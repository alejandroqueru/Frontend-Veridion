import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ALICE,
  BOB,
  clearAuthEnv,
  openTestSession,
  useTestSessionSecret,
} from '@/features/auth/__tests__/support';
import { resetSessionStore } from '@/features/auth/session-store';
import { getConsentStore, resetConsentStore } from '@/features/developer-api/consent-store';

import { DELETE, GET, POST } from './route';

const ADDRESS = ALICE.publicKey();

function jsonPost(body: unknown, headers: Headers = new Headers()) {
  const merged = new Headers(headers);
  merged.set('content-type', 'application/json');
  return new Request('http://localhost/api/v1/consent', {
    method: 'POST',
    headers: merged,
    body: JSON.stringify(body),
  }) as never;
}

function del(query: string, headers: Headers = new Headers()) {
  return new Request(`http://localhost/api/v1/consent?${query}`, { method: 'DELETE', headers }) as never;
}

function get(query: string, headers: Headers = new Headers()) {
  return new Request(`http://localhost/api/v1/consent?${query}`, { headers }) as never;
}

beforeEach(() => {
  useTestSessionSecret();
  resetConsentStore();
  resetSessionStore();
});

afterEach(() => {
  clearAuthEnv();
  resetConsentStore();
  resetSessionStore();
});

describe('consent route — authentication', () => {
  it('refuses to grant without a session', async () => {
    const res = await POST(jsonPost({ appId: 'app-1', subject: ADDRESS }));
    expect(res.status).toBe(401);
    // The point of the whole change: an unauthenticated call must not write.
    expect(await getConsentStore().isGranted('app-1', ADDRESS)).toBe(false);
  });

  it('refuses to list or revoke without a session', async () => {
    expect((await GET(get(`subject=${ADDRESS}`))).status).toBe(401);
    expect((await DELETE(del(`appId=app-1&subject=${ADDRESS}`))).status).toBe(401);
  });

  it('still validates the request shape before anything else', async () => {
    const { headers } = await openTestSession(ADDRESS);
    expect((await POST(jsonPost({ appId: 'app-1' }, headers))).status).toBe(400);
    expect((await GET(get('', headers))).status).toBe(400);
  });
});

describe('consent route — subject binding', () => {
  it('rejects a session acting on someone else’s subject', async () => {
    // BOB is authenticated, but the grant names ALICE.
    const { headers } = await openTestSession(BOB.publicKey());

    const res = await POST(jsonPost({ appId: 'app-1', subject: ADDRESS }, headers));
    expect(res.status).toBe(403);
    expect(await getConsentStore().isGranted('app-1', ADDRESS)).toBe(false);
  });

  it('rejects a mismatched subject on revoke and list too', async () => {
    const { headers } = await openTestSession(BOB.publicKey());
    expect((await DELETE(del(`appId=app-1&subject=${ADDRESS}`, headers))).status).toBe(403);
    expect((await GET(get(`subject=${ADDRESS}`, headers))).status).toBe(403);
  });

  it('does not let a staff role act on another address’s consent', async () => {
    // Being an admin is authority over the review surface, not over someone
    // else's personal data.
    process.env.VERIDION_ADMIN_ADDRESSES = BOB.publicKey();
    const { headers } = await openTestSession(BOB.publicKey());

    expect((await POST(jsonPost({ appId: 'app-1', subject: ADDRESS }, headers))).status).toBe(403);
  });

  it('rejects a session that has been revoked', async () => {
    const { headers } = await openTestSession(ADDRESS);
    resetSessionStore();
    expect((await POST(jsonPost({ appId: 'app-1', subject: ADDRESS }, headers))).status).toBe(401);
  });
});

describe('consent route — authorized use', () => {
  it('grants consent via POST and reflects it in the store', async () => {
    const { headers } = await openTestSession(ADDRESS);

    const res = await POST(jsonPost({ appId: 'app-1', subject: ADDRESS }, headers));
    expect(res.status).toBe(200);
    expect(await getConsentStore().isGranted('app-1', ADDRESS)).toBe(true);
  });

  it('revokes consent via DELETE', async () => {
    const { headers } = await openTestSession(ADDRESS);
    await getConsentStore().grant('app-1', ADDRESS);

    const res = await DELETE(del(`appId=app-1&subject=${ADDRESS}`, headers));
    expect(res.status).toBe(200);
    expect(await getConsentStore().isGranted('app-1', ADDRESS)).toBe(false);
  });

  it('lists grants for a subject via GET', async () => {
    const { headers } = await openTestSession(ADDRESS);
    await getConsentStore().grant('app-1', ADDRESS);
    await getConsentStore().grant('app-2', ADDRESS);

    const body = await (await GET(get(`subject=${ADDRESS}`, headers))).json();
    expect(body.grants).toHaveLength(2);
  });
});
