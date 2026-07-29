import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { issueApiKey } from '@/features/developer-api/api-keys';
import { getConsentStore, resetConsentStore } from '@/features/developer-api/consent-store';
import {
  resetVerificationLookup,
  setVerificationLookup,
} from '@/features/developer-api/verification-source';
import type { VerificationEvent } from '@/features/scoring/types';

import { GET } from './route';

const SECRET = 'test-signing-secret';
const ADDRESS = `G${'A'.repeat(55)}`;
const APP_ID = 'app-test';

function request(url: string, apiKey?: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return new Request(url, { headers }) as never;
}

function keyWith(scopes: ('read:status' | 'read:score')[], appId = APP_ID) {
  return issueApiKey({ appName: 'Test App', scopes, appId }, SECRET).key;
}

const sampleEvents: VerificationEvent[] = [
  {
    eventId: 'e1',
    providerId: 'github',
    category: 'social',
    occurredAt: Date.now(),
    algorithmVersionAtCapture: 'v1',
    rawPayload: { legacyPoints: 6 },
    source: 'live',
  },
];

beforeEach(() => {
  process.env.VERIDION_API_KEY_SECRET = SECRET;
  resetVerificationLookup();
  resetConsentStore();
});
afterEach(() => {
  resetVerificationLookup();
  resetConsentStore();
});

describe('GET /api/v1/verification-status', () => {
  it('rejects requests without an API key', async () => {
    const res = await GET(request(`http://localhost/api/v1/verification-status?address=${ADDRESS}`));
    expect(res.status).toBe(401);
  });

  it('rejects a request with no address or token', async () => {
    const res = await GET(request('http://localhost/api/v1/verification-status', keyWith(['read:status'])));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid Stellar address', async () => {
    const res = await GET(
      request('http://localhost/api/v1/verification-status?address=not-valid', keyWith(['read:status'])),
    );
    expect(res.status).toBe(400);
  });

  it('enforces consent: 403 without → 200 with → 403 after revoke', async () => {
    const url = `http://localhost/api/v1/verification-status?address=${ADDRESS}`;
    const key = keyWith(['read:status']);

    // No consent yet.
    expect((await GET(request(url, key))).status).toBe(403);

    // User grants consent.
    await getConsentStore().grant(APP_ID, ADDRESS);
    expect((await GET(request(url, key))).status).toBe(200);

    // User revokes — access must stop immediately.
    await getConsentStore().revoke(APP_ID, ADDRESS);
    expect((await GET(request(url, key))).status).toBe(403);
  });

  it('returns unverified for a consented but unknown address', async () => {
    await getConsentStore().grant(APP_ID, ADDRESS);
    const res = await GET(
      request(`http://localhost/api/v1/verification-status?address=${ADDRESS}`, keyWith(['read:status'])),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ verified: false, status: 'unverified', humanScore: 0 });
    expect(body.categories).toBeUndefined();
  });

  it('returns verified data and honors read:score', async () => {
    await getConsentStore().grant(APP_ID, ADDRESS);
    setVerificationLookup(async () => sampleEvents);

    const res = await GET(
      request(`http://localhost/api/v1/verification-status?address=${ADDRESS}`, keyWith(['read:status', 'read:score'])),
    );
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.humanScore).toBeGreaterThan(0);
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it('omits the score breakdown for a status-only key', async () => {
    await getConsentStore().grant(APP_ID, ADDRESS);
    setVerificationLookup(async () => sampleEvents);
    const res = await GET(
      request(`http://localhost/api/v1/verification-status?address=${ADDRESS}`, keyWith(['read:status'])),
    );
    const body = await res.json();
    expect(body.categories).toBeUndefined();
  });
});
