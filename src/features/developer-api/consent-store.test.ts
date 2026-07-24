import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryConsentStore } from './consent-store';

describe('InMemoryConsentStore', () => {
  let store: InMemoryConsentStore;
  beforeEach(() => {
    store = new InMemoryConsentStore();
  });

  it('grants and reports consent', async () => {
    expect(await store.isGranted('app-1', 'G1')).toBe(false);
    await store.grant('app-1', 'G1');
    expect(await store.isGranted('app-1', 'G1')).toBe(true);
  });

  it('scopes consent per (app, subject) pair', async () => {
    await store.grant('app-1', 'G1');
    expect(await store.isGranted('app-1', 'G2')).toBe(false);
    expect(await store.isGranted('app-2', 'G1')).toBe(false);
  });

  it('revokes consent immediately', async () => {
    await store.grant('app-1', 'G1');
    await store.revoke('app-1', 'G1');
    expect(await store.isGranted('app-1', 'G1')).toBe(false);
  });

  it('lists grants for a subject only', async () => {
    await store.grant('app-1', 'G1');
    await store.grant('app-2', 'G1');
    await store.grant('app-1', 'G2');
    const grants = await store.listForSubject('G1');
    expect(grants.map((g) => g.appId).sort()).toEqual(['app-1', 'app-2']);
  });

  it('is idempotent on repeated grants', async () => {
    await store.grant('app-1', 'G1');
    await store.grant('app-1', 'G1');
    expect(await store.listForSubject('G1')).toHaveLength(1);
  });
});
