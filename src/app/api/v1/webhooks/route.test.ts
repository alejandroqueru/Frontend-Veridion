import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { issueApiKey } from '@/features/developer-api/api-keys';
import { getConsentStore, resetConsentStore } from '@/features/developer-api/consent-store';
import { getWebhookStore, resetWebhookStore } from '@/features/developer-api/webhook-store';

import { DELETE, GET, POST } from './route';

const SECRET = 'test-signing-secret';
const SUBJECT = `G${'A'.repeat(55)}`;
const APP_ID = 'app-hooks';

function key(scopes: ('read:status' | 'read:score' | 'manage:webhooks')[]) {
  return issueApiKey({ appName: 'Hook App', scopes, appId: APP_ID }, SECRET).key;
}

function postReq(apiKey: string | undefined, body: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return new Request('http://localhost/api/v1/webhooks', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  process.env.VERIDION_API_KEY_SECRET = SECRET;
  resetConsentStore();
  resetWebhookStore();
});
afterEach(() => {
  resetConsentStore();
  resetWebhookStore();
});

describe('webhooks route', () => {
  it('requires an API key with manage:webhooks scope', async () => {
    expect((await POST(postReq(undefined, { subject: SUBJECT, url: 'https://x' }))).status).toBe(401);
    expect((await POST(postReq(key(['read:status']), { subject: SUBJECT, url: 'https://x' }))).status).toBe(403);
  });

  it('requires consent before subscribing', async () => {
    const res = await POST(postReq(key(['manage:webhooks']), { subject: SUBJECT, url: 'https://x.com' }));
    expect(res.status).toBe(403);
  });

  it('validates url and subject', async () => {
    await getConsentStore().grant(APP_ID, SUBJECT);
    expect((await POST(postReq(key(['manage:webhooks']), { subject: SUBJECT, url: 'http://insecure' }))).status).toBe(400);
    expect((await POST(postReq(key(['manage:webhooks']), { subject: 'bad', url: 'https://x.com' }))).status).toBe(400);
  });

  it('creates a subscription and returns the secret once', async () => {
    await getConsentStore().grant(APP_ID, SUBJECT);
    const res = await POST(postReq(key(['manage:webhooks']), { subject: SUBJECT, url: 'https://x.com/hook' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.secret).toMatch(/^whsec_/);
    expect(await getWebhookStore().listForApp(APP_ID)).toHaveLength(1);
  });

  it('lists subscriptions without exposing secrets, and deletes them', async () => {
    await getConsentStore().grant(APP_ID, SUBJECT);
    const created = await (
      await POST(postReq(key(['manage:webhooks']), { subject: SUBJECT, url: 'https://x.com/hook' }))
    ).json();

    const listReq = new Request('http://localhost/api/v1/webhooks', {
      headers: { authorization: `Bearer ${key(['manage:webhooks'])}` },
    }) as never;
    const listBody = await (await GET(listReq)).json();
    expect(listBody.subscriptions).toHaveLength(1);
    expect(listBody.subscriptions[0].secret).toBeUndefined();

    const delReq = new Request(`http://localhost/api/v1/webhooks?id=${created.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${key(['manage:webhooks'])}` },
    }) as never;
    expect((await DELETE(delReq)).status).toBe(200);
    expect(await getWebhookStore().listForApp(APP_ID)).toHaveLength(0);
  });
});
