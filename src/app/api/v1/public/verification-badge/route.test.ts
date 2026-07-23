import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  resetVerificationLookup,
  setVerificationLookup,
} from '@/features/developer-api/verification-source';

import { GET } from './route';

const ADDRESS = `G${'A'.repeat(55)}`;

function request(url: string) {
  return new Request(url) as never;
}

beforeEach(() => resetVerificationLookup());
afterEach(() => resetVerificationLookup());

describe('GET /api/v1/public/verification-badge', () => {
  it('needs no API key and rejects an invalid address', async () => {
    expect((await GET(request('http://localhost/api/v1/public/verification-badge'))).status).toBe(400);
    expect(
      (await GET(request('http://localhost/api/v1/public/verification-badge?address=nope'))).status,
    ).toBe(400);
  });

  it('returns only a minimal unverified status for an unknown address', async () => {
    const res = await GET(request(`http://localhost/api/v1/public/verification-badge?address=${ADDRESS}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ verified: false, status: 'unverified' });
  });

  it('reflects a verified address from the lookup, without leaking score', async () => {
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
    const res = await GET(request(`http://localhost/api/v1/public/verification-badge?address=${ADDRESS}`));
    const body = await res.json();
    expect(body).toEqual({ verified: true, status: 'verified' });
  });
});
