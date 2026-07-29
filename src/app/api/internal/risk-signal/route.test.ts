import { beforeEach, describe, expect, it } from 'vitest';

import { getRiskAssessment } from '@/features/risk-signals/service';
import { resetRiskAssessmentStore } from '@/features/risk-signals/store/risk-assessment-store';
import { resetRiskEventStore } from '@/features/risk-signals/store/risk-event-store';

import { POST } from './route';

const SUBJECT = `G${'A'.repeat(55)}`;

function postReq(body: unknown) {
  return new Request('http://localhost/api/internal/risk-signal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  resetRiskEventStore();
  resetRiskAssessmentStore();
});

describe('internal risk-signal route', () => {
  it('rejects an invalid subject', async () => {
    const res = await POST(postReq({ subject: 'not-an-address', fingerprint: 'a'.repeat(20), providerId: 'github' }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing/too-short fingerprint', async () => {
    const res = await POST(postReq({ subject: SUBJECT, fingerprint: 'short', providerId: 'github' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid providerId', async () => {
    const res = await POST(postReq({ subject: SUBJECT, fingerprint: 'a'.repeat(20), providerId: '' }));
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

  it('records a valid signal and never returns score/signal data to the caller', async () => {
    const res = await POST(postReq({ subject: SUBJECT, fingerprint: 'a'.repeat(20), providerId: 'github' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ recorded: true });

    // The assessment was computed and stored server-side...
    expect(getRiskAssessment(SUBJECT)).not.toBeNull();
  });

  it('rate-limits repeated requests from the same fingerprint', async () => {
    const fingerprint = `rl-${Math.random().toString(36).slice(2)}`.padEnd(20, '0');
    let lastStatus = 200;
    for (let i = 0; i < 25; i++) {
      const res = await POST(postReq({ subject: SUBJECT, fingerprint, providerId: 'github' }));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('accepts an optional phone field for phone-verification completions', async () => {
    const res = await POST(
      postReq({ subject: SUBJECT, fingerprint: 'b'.repeat(20), providerId: 'phone-verification', phone: '+18005551234' }),
    );
    expect(res.status).toBe(200);
    expect(getRiskAssessment(SUBJECT)?.signals.some((s) => s.type === 'disposable-phone' && s.score === 1)).toBe(true);
  });
});
