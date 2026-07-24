import { describe, expect, it, vi } from 'vitest';

import { deliverToSubscription, signPayload, type WebhookEvent } from './webhook-delivery';
import type { WebhookSubscription } from './webhook-store';

const sub: WebhookSubscription = {
  id: 'sub-1',
  appId: 'app-1',
  subject: `G${'A'.repeat(55)}`,
  url: 'https://example.com/hook',
  secret: 'whsec_test',
  createdAt: 0,
};

const event: WebhookEvent = {
  type: 'verification.status.changed',
  subject: sub.subject,
  data: { status: 'verified' },
  timestamp: 1_700_000_000_000,
};

const noSleep = vi.fn(async () => {});

describe('signPayload', () => {
  it('is deterministic and secret-dependent', () => {
    const a = signPayload(1, 'body', 'secret');
    expect(signPayload(1, 'body', 'secret')).toBe(a);
    expect(signPayload(1, 'body', 'other')).not.toBe(a);
    expect(signPayload(2, 'body', 'secret')).not.toBe(a);
  });
});

describe('deliverToSubscription', () => {
  it('delivers on the first attempt and signs the payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const result = await deliverToSubscription(sub, event, { fetch: fetchMock, sleep: noSleep });

    expect(result).toEqual({ delivered: true, attempts: 1, delays: [] });
    const [, init] = fetchMock.mock.calls[0];
    const expectedSig = `sha256=${signPayload(event.timestamp, JSON.stringify(event), sub.secret)}`;
    expect(init.headers['x-veridion-signature']).toBe(expectedSig);
    expect(init.headers['x-veridion-event']).toBe('verification.status.changed');
  });

  it('retries with exponential backoff, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true });

    const result = await deliverToSubscription(sub, event, {
      fetch: fetchMock,
      sleep: noSleep,
      baseDelayMs: 500,
      maxRetries: 4,
    });

    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(3);
    expect(result.delays).toEqual([500, 1000]);
  });

  it('gives up after maxRetries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    const result = await deliverToSubscription(sub, event, {
      fetch: fetchMock,
      sleep: noSleep,
      baseDelayMs: 100,
      maxRetries: 2,
    });

    expect(result.delivered).toBe(false);
    expect(result.attempts).toBe(3); // initial + 2 retries
    expect(result.delays).toEqual([100, 200]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
