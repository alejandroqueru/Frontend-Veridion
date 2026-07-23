import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { issueApiKey } from '@/features/developer-api/api-keys';
import {
  resetVerificationLookup,
  setVerificationLookup,
} from '@/features/developer-api/verification-source';
import type { VerificationEvent } from '@/features/scoring/types';

import { GET } from './route';

const SECRET = 'test-signing-secret';
const ADDRESS = `G${'A'.repeat(55)}`;

function request(url: string, apiKey?: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return new Request(url, { headers }) as never; // NextRequest is Request-compatible
}

function keyWith(scopes: ('read:status' | 'read:score')[]) {
  return issueApiKey({ appName: 'Test App', scopes }, SECRET).key;
}

beforeEach(() => {
  process.env.VERIDION_API_KEY_SECRET = SECRET;
  resetVerificationLookup();
});
afterEach(() => resetVerificationLookup());

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

  it('returns unverified for an unknown address', async () => {
    const res = await GET(
      request(`http://localhost/api/v1/verification-status?address=${ADDRESS}`, keyWith(['read:status'])),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ verified: false, status: 'unverified', humanScore: 0 });
    expect(body.categories).toBeUndefined();
  });

  it('returns verified data from the lookup and honors read:score', async () => {
    const events: VerificationEvent[] = [
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
    setVerificationLookup(async () => events);

    const res = await GET(
      request(
        `http://localhost/api/v1/verification-status?address=${ADDRESS}`,
        keyWith(['read:status', 'read:score']),
      ),
    );
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.humanScore).toBeGreaterThan(0);
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it('omits the score breakdown for a status-only key', async () => {
    setVerificationLookup(async () => [
      {
        eventId: 'e1',
        providerId: 'github',
        category: 'social',
        occurredAt: Date.now(),
        algorithmVersionAtCapture: 'v1',
        rawPayload: { legacyPoints: 6 },
        source: 'live',
      },
    ]);
    const res = await GET(
      request(`http://localhost/api/v1/verification-status?address=${ADDRESS}`, keyWith(['read:status'])),
    );
    const body = await res.json();
    expect(body.categories).toBeUndefined();
  });
});
