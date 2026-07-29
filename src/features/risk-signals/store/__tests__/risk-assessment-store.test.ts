import { describe, expect, it } from 'vitest';

import { InMemoryRiskAssessmentStore } from '../risk-assessment-store';

const NOW = 1_700_000_000_000;

function assessment(subject: string, score: number, computedAt = NOW) {
  return { subject, score, signals: [], computedAt };
}

describe('InMemoryRiskAssessmentStore', () => {
  it('returns null for a subject with no saved assessment', async () => {
    const store = new InMemoryRiskAssessmentStore();
    expect(await store.getLatest('never-seen')).toBeNull();
  });

  it('returns the most recently saved assessment for a subject', async () => {
    const store = new InMemoryRiskAssessmentStore();
    await store.save(assessment('wallet-a', 10, NOW));
    await store.save(assessment('wallet-a', 40, NOW + 1));

    expect(await store.getLatest('wallet-a')).toEqual(assessment('wallet-a', 40, NOW + 1));
  });

  it('keeps different subjects independent', async () => {
    const store = new InMemoryRiskAssessmentStore();
    await store.save(assessment('wallet-a', 10));
    await store.save(assessment('wallet-b', 90));

    expect((await store.getLatest('wallet-a'))?.score).toBe(10);
    expect((await store.getLatest('wallet-b'))?.score).toBe(90);
  });

  it('listAbove returns only subjects at or above the threshold, most recent first', async () => {
    const store = new InMemoryRiskAssessmentStore();
    await store.save(assessment('wallet-low', 10, NOW));
    await store.save(assessment('wallet-high-old', 80, NOW));
    await store.save(assessment('wallet-high-new', 75, NOW + 1000));

    const flagged = await store.listAbove(50, 10);
    expect(flagged.map((a) => a.subject)).toEqual(['wallet-high-new', 'wallet-high-old']);
  });

  it('listAbove is inclusive of the threshold itself', async () => {
    const store = new InMemoryRiskAssessmentStore();
    await store.save(assessment('wallet-exact', 50));

    expect(await store.listAbove(50, 10)).toHaveLength(1);
  });

  it('listAbove respects the limit', async () => {
    const store = new InMemoryRiskAssessmentStore();
    for (let i = 0; i < 5; i++) {
      await store.save(assessment(`wallet-${i}`, 90, NOW + i));
    }

    expect(await store.listAbove(50, 2)).toHaveLength(2);
  });
});
