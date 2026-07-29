import { describe, expect, it } from 'vitest';

import { InMemoryRiskEventStore } from '../risk-event-store';

const NOW = 1_700_000_000_000;

describe('InMemoryRiskEventStore', () => {
  it('returns distinct subjects observed under a fingerprint within the window', async () => {
    const store = new InMemoryRiskEventStore();
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'github', timestamp: NOW });
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-b', providerId: 'discord', timestamp: NOW + 1000 });
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'linkedin', timestamp: NOW + 2000 });

    const subjects = await store.distinctSubjectsForFingerprint('fp-1', 60_000, NOW + 2000);
    expect(subjects.sort()).toEqual(['wallet-a', 'wallet-b']);
  });

  it('excludes subjects outside the trailing window', async () => {
    const store = new InMemoryRiskEventStore();
    await store.record({ fingerprint: 'fp-2', subject: 'wallet-old', providerId: 'github', timestamp: NOW });
    await store.record({ fingerprint: 'fp-2', subject: 'wallet-new', providerId: 'github', timestamp: NOW + 120_000 });

    const subjects = await store.distinctSubjectsForFingerprint('fp-2', 60_000, NOW + 120_000);
    expect(subjects).toEqual(['wallet-new']);
  });

  it('keeps different fingerprints independent', async () => {
    const store = new InMemoryRiskEventStore();
    await store.record({ fingerprint: 'fp-a', subject: 'wallet-1', providerId: 'github', timestamp: NOW });
    await store.record({ fingerprint: 'fp-b', subject: 'wallet-2', providerId: 'github', timestamp: NOW });

    expect(await store.distinctSubjectsForFingerprint('fp-a', 60_000, NOW)).toEqual(['wallet-1']);
    expect(await store.distinctSubjectsForFingerprint('fp-b', 60_000, NOW)).toEqual(['wallet-2']);
  });

  it('returns completion timestamps for a subject within the window', async () => {
    const store = new InMemoryRiskEventStore();
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'github', timestamp: NOW });
    await store.record({ fingerprint: 'fp-2', subject: 'wallet-a', providerId: 'discord', timestamp: NOW + 500 });
    await store.record({
      fingerprint: 'fp-3',
      subject: 'wallet-a',
      providerId: 'linkedin',
      timestamp: NOW + 10 * 60 * 1000,
    });

    // Queried after all three, with a window wide enough to reach back to the first two.
    const wide = await store.timestampsForSubject('wallet-a', 11 * 60 * 1000, NOW + 10 * 60 * 1000);
    expect(wide).toEqual([NOW, NOW + 500, NOW + 10 * 60 * 1000]);

    // Same query point, narrower window: only the most recent one qualifies.
    const narrow = await store.timestampsForSubject('wallet-a', 60_000, NOW + 10 * 60 * 1000);
    expect(narrow).toEqual([NOW + 10 * 60 * 1000]);
  });

  it('returns distinct subjects observed from an IP within the window, independent of fingerprint', async () => {
    const store = new InMemoryRiskEventStore();
    await store.record({
      fingerprint: 'fp-x',
      subject: 'wallet-a',
      providerId: 'github',
      timestamp: NOW,
      ip: '203.0.113.5',
    });
    await store.record({
      fingerprint: 'fp-y', // different device, same network
      subject: 'wallet-b',
      providerId: 'discord',
      timestamp: NOW + 1000,
      ip: '203.0.113.5',
    });

    const subjects = await store.distinctSubjectsForIp('203.0.113.5', 60_000, NOW + 1000);
    expect(subjects.sort()).toEqual(['wallet-a', 'wallet-b']);
  });

  it('does not index events with no IP under any IP key', async () => {
    const store = new InMemoryRiskEventStore();
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'github', timestamp: NOW });

    expect(await store.distinctSubjectsForIp('203.0.113.5', 60_000, NOW)).toEqual([]);
  });

  it('returns empty results for a fingerprint/subject that was never recorded', async () => {
    const store = new InMemoryRiskEventStore();
    expect(await store.distinctSubjectsForFingerprint('never-seen', 60_000, NOW)).toEqual([]);
    expect(await store.timestampsForSubject('never-seen', 60_000, NOW)).toEqual([]);
  });

  it('caps entries per key so a single fingerprint cannot grow the store unboundedly', async () => {
    const store = new InMemoryRiskEventStore();
    const fingerprint = 'fp-flood';

    // Well beyond MAX_ENTRIES_PER_KEY (500), all inside the retention window.
    for (let i = 0; i < 700; i++) {
      await store.record({ fingerprint, subject: `wallet-${i}`, providerId: 'github', timestamp: NOW + i });
    }

    const subjects = await store.distinctSubjectsForFingerprint(fingerprint, 24 * 60 * 60 * 1000, NOW + 700);
    expect(subjects.length).toBeLessThanOrEqual(500);
    // The trim keeps the most recent entries, not the oldest.
    expect(subjects).toContain('wallet-699');
    expect(subjects).not.toContain('wallet-0');
  });
});
