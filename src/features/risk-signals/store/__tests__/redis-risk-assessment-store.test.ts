import { describe, expect, it } from 'vitest';

import { RedisRiskAssessmentStore } from '../redis-risk-assessment-store';
import { FakeRedisClient } from './fake-redis-client';

const NOW = 1_700_000_000_000;

function assessment(subject: string, score: number, computedAt = NOW) {
  return { subject, score, signals: [], computedAt };
}

// Same contract as InMemoryRiskAssessmentStore's test suite (see
// risk-assessment-store.test.ts).
describe('RedisRiskAssessmentStore', () => {
  it('returns null for a subject with no saved assessment', async () => {
    const store = new RedisRiskAssessmentStore(new FakeRedisClient());
    expect(await store.getLatest('never-seen')).toBeNull();
  });

  it('overwrites with the latest save for a subject', async () => {
    const store = new RedisRiskAssessmentStore(new FakeRedisClient());
    await store.save(assessment('wallet-a', 10, NOW));
    await store.save(assessment('wallet-a', 40, NOW + 1));

    expect(await store.getLatest('wallet-a')).toEqual(assessment('wallet-a', 40, NOW + 1));
  });

  it('keeps different subjects independent', async () => {
    const store = new RedisRiskAssessmentStore(new FakeRedisClient());
    await store.save(assessment('wallet-a', 10));
    await store.save(assessment('wallet-b', 90));

    expect((await store.getLatest('wallet-a'))?.score).toBe(10);
    expect((await store.getLatest('wallet-b'))?.score).toBe(90);
  });

  it('listAbove returns only subjects at or above the threshold, most recent first', async () => {
    const store = new RedisRiskAssessmentStore(new FakeRedisClient());
    await store.save(assessment('wallet-low', 10, NOW));
    await store.save(assessment('wallet-high-old', 80, NOW));
    await store.save(assessment('wallet-high-new', 75, NOW + 1000));

    const flagged = await store.listAbove(50, 10);
    expect(flagged.map((a) => a.subject)).toEqual(['wallet-high-new', 'wallet-high-old']);
  });

  it('listAbove respects the limit', async () => {
    const store = new RedisRiskAssessmentStore(new FakeRedisClient());
    for (let i = 0; i < 5; i++) {
      await store.save(assessment(`wallet-${i}`, 90, NOW + i));
    }

    expect(await store.listAbove(50, 2)).toHaveLength(2);
  });

  it('does not confuse assessment keys with other keys in the same client', async () => {
    const client = new FakeRedisClient();
    await client.set('some-other-namespace:wallet-a', 'unrelated-value');
    const store = new RedisRiskAssessmentStore(client);
    await store.save(assessment('wallet-b', 90));

    const flagged = await store.listAbove(0, 10);
    expect(flagged.map((a) => a.subject)).toEqual(['wallet-b']);
  });
});
