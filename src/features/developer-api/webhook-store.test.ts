import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryWebhookStore } from './webhook-store';

const SUBJECT = `G${'A'.repeat(55)}`;

describe('InMemoryWebhookStore', () => {
  let store: InMemoryWebhookStore;
  beforeEach(() => {
    store = new InMemoryWebhookStore();
  });

  it('creates and lists subscriptions by app and subject', async () => {
    const sub = await store.create({ appId: 'app-1', subject: SUBJECT, url: 'https://a', secret: 's' });
    expect(sub.id).toBeTruthy();
    expect(await store.listForApp('app-1')).toHaveLength(1);
    expect(await store.listForSubject(SUBJECT)).toHaveLength(1);
    expect(await store.listForApp('app-2')).toHaveLength(0);
  });

  it('only lets the owning app delete a subscription', async () => {
    const sub = await store.create({ appId: 'app-1', subject: SUBJECT, url: 'https://a', secret: 's' });
    expect(await store.delete(sub.id, 'app-2')).toBe(false);
    expect(await store.delete(sub.id, 'app-1')).toBe(true);
    expect(await store.listForApp('app-1')).toHaveLength(0);
  });
});
