import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ALICE,
  BOB,
  clearAuthEnv,
  openTestSession,
  useTestSessionSecret,
} from '@/features/auth/__tests__/support';
import { resetSessionStore } from '@/features/auth/session-store';
import { recordVerificationSignal } from '@/features/risk-signals/service';
import { resetRiskAssessmentStore } from '@/features/risk-signals/store/risk-assessment-store';
import { resetRiskEventStore } from '@/features/risk-signals/store/risk-event-store';

import { GET } from './route';

const NOW = 1_700_000_000_000;

/** A request carrying a given reviewer's session, or none at all. */
function getReq(query = '', headers: Headers = new Headers()) {
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

/** ALICE is on the reviewer allowlist; BOB is a plain authenticated user. */
async function reviewerHeaders(): Promise<Headers> {
  process.env.VERIDION_REVIEWER_ADDRESSES = ALICE.publicKey();
  return (await openTestSession(ALICE.publicKey())).headers;
}

beforeEach(() => {
  useTestSessionSecret();
  resetSessionStore();
  resetRiskEventStore();
  resetRiskAssessmentStore();
});

afterEach(() => {
  clearAuthEnv();
  resetSessionStore();
});

describe('internal risk-review route — authorization', () => {
  it('rejects a request with no session', async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  it('rejects a forged or corrupted session token', async () => {
    const headers = new Headers({ authorization: 'Bearer vsa_forged.signature' });
    expect((await GET(getReq('', headers))).status).toBe(401);
  });

  it('rejects a valid session that lacks the reviewer role', async () => {
    // BOB proved he owns his address — that is authentication, not authority.
    const { headers } = await openTestSession(BOB.publicKey());
    expect((await GET(getReq('', headers))).status).toBe(403);
  });

  it('rejects a reviewer whose session has been revoked', async () => {
    const headers = await reviewerHeaders();
    resetSessionStore(); // stands in for "signed out everywhere"
    expect((await GET(getReq('', headers))).status).toBe(401);
  });

  it('rejects a reviewer who has been removed from the allowlist', async () => {
    const headers = await reviewerHeaders();
    // The token still says `reviewer`; the allowlist no longer does. The
    // allowlist wins, without waiting for the token to expire.
    delete process.env.VERIDION_REVIEWER_ADDRESSES;
    expect((await GET(getReq('', headers))).status).toBe(403);
  });

  it('accepts a senior reviewer by role implication', async () => {
    process.env.VERIDION_SENIOR_REVIEWER_ADDRESSES = BOB.publicKey();
    const { headers } = await openTestSession(BOB.publicKey());
    expect((await GET(getReq('?minScore=1', headers))).status).toBe(200);
  });

  it('fails closed when the signing secret is not configured', async () => {
    const headers = await reviewerHeaders();
    delete process.env.VERIDION_SESSION_SECRET;
    expect((await GET(getReq('', headers))).status).toBe(500);
  });
});

describe('internal risk-review route — results', () => {
  it('returns flagged assessments for an authorized reviewer', async () => {
    const headers = await reviewerHeaders();
    await seedFlaggedSubject('wallet-flagged', 'fp-1');

    const res = await GET(getReq('?minScore=1', headers));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.assessments.some((a: { subject: string }) => a.subject === 'wallet-flagged')).toBe(true);
  });

  it('excludes subjects below the minScore threshold', async () => {
    const headers = await reviewerHeaders();
    await recordVerificationSignal({ subject: 'wallet-clean', fingerprint: 'fp-clean', providerId: 'github', now: NOW });
    await seedFlaggedSubject('wallet-flagged', 'fp-2');

    const body = await (await GET(getReq('?minScore=1', headers))).json();
    expect(body.assessments.map((a: { subject: string }) => a.subject)).not.toContain('wallet-clean');
  });

  it('rejects an out-of-range minScore', async () => {
    const headers = await reviewerHeaders();
    expect((await GET(getReq('?minScore=101', headers))).status).toBe(400);
    expect((await GET(getReq('?minScore=-1', headers))).status).toBe(400);
    expect((await GET(getReq('?minScore=not-a-number', headers))).status).toBe(400);
  });

  it('rejects an invalid limit', async () => {
    const headers = await reviewerHeaders();
    expect((await GET(getReq('?limit=0', headers))).status).toBe(400);
    expect((await GET(getReq('?limit=201', headers))).status).toBe(400);
    expect((await GET(getReq('?limit=1.5', headers))).status).toBe(400);
  });

  it('respects a valid custom limit', async () => {
    const headers = await reviewerHeaders();
    for (let i = 0; i < 3; i++) {
      await seedFlaggedSubject(`wallet-${i}`, `fp-${i}`);
    }
    const body = await (await GET(getReq('?minScore=1&limit=2', headers))).json();
    expect(body.assessments).toHaveLength(2);
  });
});
