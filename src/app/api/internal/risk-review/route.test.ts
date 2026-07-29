import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordVerificationSignal } from '@/features/risk-signals/service';
import { resetRiskAssessmentStore } from '@/features/risk-signals/store/risk-assessment-store';
import { resetRiskEventStore } from '@/features/risk-signals/store/risk-event-store';

import { GET } from './route';

const TOKEN = 'test-internal-review-token';
const NOW = 1_700_000_000_000;

// `null` (not the default parameter) means "omit the header" — a default
// value triggers on an explicit `undefined` argument too in JS, so
// `undefined` can't double as that sentinel here.
function getReq(query = '', token: string | null = TOKEN) {
  const headers: Record<string, string> = {};
  if (token !== null) headers['x-internal-token'] = token;
  return new Request(`http://localhost/api/internal/risk-review${query}`, { headers }) as never;
}

async function seedFlaggedSubject(subject: string, fingerprint: string) {
  // A disposable-phone hit is enough for a nonzero score. Tests that need
  // it to clear the route's default minScore=50 pass an explicit low
  // `?minScore=` instead of relying on this producing any particular
  // number — that number is risk-engine.ts's concern (see
  // engine/__tests__/risk-engine.test.ts), not this route's.
  return recordVerificationSignal({
    subject,
    fingerprint,
    providerId: 'phone-verification',
    phone: '+18005551234',
    now: NOW,
  });
}

beforeEach(() => {
  process.env.RISK_REVIEW_TOKEN = TOKEN;
  resetRiskEventStore();
  resetRiskAssessmentStore();
});

afterEach(() => {
  delete process.env.RISK_REVIEW_TOKEN;
});

describe('internal risk-review route', () => {
  it('rejects a request with no token header', async () => {
    const res = await GET(getReq('', null));
    expect(res.status).toBe(401);
  });

  it('rejects a request with the wrong token', async () => {
    const res = await GET(getReq('', 'wrong-token'));
    expect(res.status).toBe(401);
  });

  it('fails closed when RISK_REVIEW_TOKEN is not configured, even with a token header', async () => {
    delete process.env.RISK_REVIEW_TOKEN;
    const res = await GET(getReq('', TOKEN));
    expect(res.status).toBe(401);
  });

  it('returns flagged assessments for an authorized request', async () => {
    await seedFlaggedSubject('wallet-flagged', 'fp-1');

    const res = await GET(getReq('?minScore=1'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assessments.some((a: { subject: string }) => a.subject === 'wallet-flagged')).toBe(true);
  });

  it('excludes subjects below the minScore threshold', async () => {
    await recordVerificationSignal({ subject: 'wallet-clean', fingerprint: 'fp-clean', providerId: 'github', now: NOW });
    await seedFlaggedSubject('wallet-flagged', 'fp-2');

    const body = await (await GET(getReq('?minScore=1'))).json();
    expect(body.assessments.map((a: { subject: string }) => a.subject)).not.toContain('wallet-clean');
  });

  it('rejects an out-of-range minScore', async () => {
    expect((await GET(getReq('?minScore=101'))).status).toBe(400);
    expect((await GET(getReq('?minScore=-1'))).status).toBe(400);
    expect((await GET(getReq('?minScore=not-a-number'))).status).toBe(400);
  });

  it('rejects an invalid limit', async () => {
    expect((await GET(getReq('?limit=0'))).status).toBe(400);
    expect((await GET(getReq('?limit=201'))).status).toBe(400);
    expect((await GET(getReq('?limit=1.5'))).status).toBe(400);
  });

  it('respects a valid custom limit', async () => {
    for (let i = 0; i < 3; i++) {
      await seedFlaggedSubject(`wallet-${i}`, `fp-${i}`);
    }
    const body = await (await GET(getReq('?minScore=1&limit=2'))).json();
    expect(body.assessments).toHaveLength(2);
  });
});
