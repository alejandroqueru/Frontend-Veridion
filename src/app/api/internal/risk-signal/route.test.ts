import { beforeEach, describe, expect, it } from 'vitest';

import { getRiskAssessment } from '@/features/risk-signals/service';
import { resetRiskAssessmentStore } from '@/features/risk-signals/store/risk-assessment-store';
import { resetRiskEventStore } from '@/features/risk-signals/store/risk-event-store';

import { POST } from './route';

const SUBJECT = `G${'A'.repeat(55)}`;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** A syntactically valid 64-char hex fingerprint, as getDeviceFingerprint() always produces. */
function fp(seedChar: string): string {
  return seedChar.repeat(64);
}

function randomFp(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * A fresh, syntactically valid Stellar-address-shaped subject per call.
 * Needed because the route now rate-limits per subject in addition to per
 * fingerprint (see route.ts) — reusing one fixed SUBJECT across every test
 * that exercises a successful/rate-limited POST would make earlier tests'
 * requests count against later ones, since rate-limiter.ts state is
 * module-level and outlives a single test. Same "unique key per test"
 * convention as developer-api/rate-limit.test.ts.
 */
function randomSubject(): string {
  let s = 'G';
  for (let i = 0; i < 55; i++) s += BASE32[Math.floor(Math.random() * BASE32.length)];
  return s;
}

function postReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/internal/risk-signal', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  resetRiskEventStore();
  resetRiskAssessmentStore();
});

describe('internal risk-signal route', () => {
  it('rejects an invalid subject', async () => {
    const res = await POST(postReq({ subject: 'not-an-address', fingerprint: fp('a'), providerId: 'github' }));
    expect(res.status).toBe(400);
  });

  it('rejects a fingerprint that is too short', async () => {
    const res = await POST(postReq({ subject: SUBJECT, fingerprint: 'short', providerId: 'github' }));
    expect(res.status).toBe(400);
  });

  it('rejects a fingerprint that is the right length but not hex', async () => {
    const res = await POST(postReq({ subject: SUBJECT, fingerprint: 'z'.repeat(64), providerId: 'github' }));
    expect(res.status).toBe(400);
  });

  it('rejects an uppercase-hex fingerprint (getDeviceFingerprint always emits lowercase)', async () => {
    const res = await POST(postReq({ subject: SUBJECT, fingerprint: 'A'.repeat(64), providerId: 'github' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid providerId', async () => {
    const res = await POST(postReq({ subject: SUBJECT, fingerprint: fp('a'), providerId: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const req = new Request('http://localhost/api/internal/risk-signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    }) as never;
    expect((await POST(req)).status).toBe(400);
  });

  it('rejects a phone number longer than E.164 allows', async () => {
    const res = await POST(
      postReq({ subject: SUBJECT, fingerprint: fp('a'), providerId: 'phone-verification', phone: `+1${'2'.repeat(20)}` }),
    );
    expect(res.status).toBe(400);
  });

  it('records a valid signal and never returns score/signal data to the caller', async () => {
    const subject = randomSubject();
    const res = await POST(postReq({ subject, fingerprint: fp('a'), providerId: 'github' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ recorded: true });

    // The assessment was computed and stored server-side...
    expect(await getRiskAssessment(subject)).not.toBeNull();
  });

  it('rate-limits repeated requests from the same fingerprint', async () => {
    const fingerprint = randomFp();
    let lastStatus = 200;
    for (let i = 0; i < 25; i++) {
      const res = await POST(postReq({ subject: randomSubject(), fingerprint, providerId: 'github' }));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('rate-limits repeated requests from the same subject, even across different fingerprints', async () => {
    const subject = randomSubject();
    let lastStatus = 200;
    for (let i = 0; i < 25; i++) {
      const res = await POST(postReq({ subject, fingerprint: randomFp(), providerId: 'github' }));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('accepts an optional phone field for phone-verification completions', async () => {
    const subject = randomSubject();
    const res = await POST(
      postReq({ subject, fingerprint: fp('b'), providerId: 'phone-verification', phone: '+18005551234' }),
    );
    expect(res.status).toBe(200);
    const assessment = await getRiskAssessment(subject);
    expect(assessment?.signals.some((s) => s.type === 'disposable-phone' && s.score === 1)).toBe(true);
  });

  it('rejects a timezoneOffsetMinutes outside the real-world UTC-offset range', async () => {
    const res = await POST(
      postReq({ subject: SUBJECT, fingerprint: fp('a'), providerId: 'github', timezoneOffsetMinutes: 2000 }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a non-numeric timezoneOffsetMinutes', async () => {
    const res = await POST(
      postReq({ subject: SUBJECT, fingerprint: fp('a'), providerId: 'github', timezoneOffsetMinutes: 'not-a-number' }),
    );
    expect(res.status).toBe(400);
  });

  it('extracts the client IP from x-forwarded-for (first hop) and feeds network correlation', async () => {
    // clientIp() takes the first entry before any comma — the client's own
    // address, not an intermediate proxy.
    const headers = { 'x-forwarded-for': '198.51.100.42, 70.41.3.18' };

    let lastSubject = '';
    for (let i = 0; i < 10; i++) {
      lastSubject = randomSubject();
      const res = await POST(
        postReq({ subject: lastSubject, fingerprint: randomFp(), providerId: 'github' }, headers),
      );
      expect(res.status).toBe(200);
    }

    const assessment = await getRiskAssessment(lastSubject);
    expect(assessment?.signals.find((s) => s.type === 'network-correlation')?.score).toBeGreaterThan(0);
    // Distinct fingerprints per request, so this isn't a device-correlation false positive.
    expect(assessment?.signals.find((s) => s.type === 'device-correlation')?.score).toBe(0);
  });

  it('records no network-correlation signal when neither forwarded-for header is present', async () => {
    const subject = randomSubject();
    await POST(postReq({ subject, fingerprint: fp('c'), providerId: 'github' }));

    const assessment = await getRiskAssessment(subject);
    expect(assessment?.signals.some((s) => s.type === 'network-correlation')).toBe(false);
  });
});
