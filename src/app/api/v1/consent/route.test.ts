import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getConsentStore, resetConsentStore } from '@/features/developer-api/consent-store';

import { DELETE, GET, POST } from './route';

const ADDRESS = `G${'A'.repeat(55)}`;

function jsonPost(body: unknown) {
  return new Request('http://localhost/api/v1/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => resetConsentStore());
afterEach(() => resetConsentStore());

describe('consent route', () => {
  it('grants consent via POST and reflects it in the store', async () => {
    const res = await POST(jsonPost({ appId: 'app-1', subject: ADDRESS }));
    expect(res.status).toBe(200);
    expect(await getConsentStore().isGranted('app-1', ADDRESS)).toBe(true);
  });

  it('validates the POST body', async () => {
    expect((await POST(jsonPost({ appId: 'app-1' }))).status).toBe(400);
    expect((await POST(jsonPost({ appId: 'app-1', subject: 'bad-subject' }))).status).toBe(400);
  });

  it('revokes consent via DELETE', async () => {
    await getConsentStore().grant('app-1', ADDRESS);
    const res = await DELETE(
      new Request(`http://localhost/api/v1/consent?appId=app-1&subject=${ADDRESS}`, {
        method: 'DELETE',
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(await getConsentStore().isGranted('app-1', ADDRESS)).toBe(false);
  });

  it('lists grants for a subject via GET', async () => {
    await getConsentStore().grant('app-1', ADDRESS);
    await getConsentStore().grant('app-2', ADDRESS);
    const res = await GET(new Request(`http://localhost/api/v1/consent?subject=${ADDRESS}`) as never);
    const body = await res.json();
    expect(body.grants).toHaveLength(2);
  });
});
