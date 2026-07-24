import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConsentStore, resetConsentStore } from './consent-store';
import { emitVerificationChange } from './webhook-events';
import { getWebhookStore, resetWebhookStore } from './webhook-store';

const SUBJECT = `G${'A'.repeat(55)}`;
const noSleep = async () => {};

beforeEach(() => {
  resetConsentStore();
  resetWebhookStore();
});
afterEach(() => {
  resetConsentStore();
  resetWebhookStore();
});

describe('emitVerificationChange', () => {
  it('delivers only to subscriptions whose app still has consent', async () => {
    const store = getWebhookStore();
    await store.create({ appId: 'app-yes', subject: SUBJECT, url: 'https://yes', secret: 's1' });
    await store.create({ appId: 'app-no', subject: SUBJECT, url: 'https://no', secret: 's2' });
    await getConsentStore().grant('app-yes', SUBJECT); // app-no did not get consent

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const result = await emitVerificationChange(
      SUBJECT,
      { status: 'verified' },
      { fetch: fetchMock, sleep: noSleep },
    );

    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0].appId).toBe('app-yes');
    expect(result.skippedNoConsent).toEqual(['app-no']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://yes', expect.objectContaining({ method: 'POST' }));
  });

  it('reports a failed delivery without throwing', async () => {
    await getWebhookStore().create({ appId: 'app-1', subject: SUBJECT, url: 'https://x', secret: 's' });
    await getConsentStore().grant('app-1', SUBJECT);

    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    const result = await emitVerificationChange(
      SUBJECT,
      { status: 'unverified' },
      { fetch: fetchMock, sleep: noSleep, maxRetries: 1, baseDelayMs: 1 },
    );

    expect(result.deliveries[0].result.delivered).toBe(false);
  });
});
