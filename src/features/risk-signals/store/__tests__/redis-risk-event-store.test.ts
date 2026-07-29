import { describe, expect, it } from 'vitest';

import { RedisRiskEventStore } from '../redis-risk-event-store';
import { FakeRedisClient } from './fake-redis-client';

const NOW = 1_700_000_000_000;

// Same behavioral contract as InMemoryRiskEventStore's test suite (see
// risk-event-store.test.ts) — this proves the Redis-shaped adapter honors
// the identical RiskEventStore interface, not just that it compiles.
describe('RedisRiskEventStore', () => {
  it('returns distinct subjects observed under a fingerprint within the window', async () => {
    const store = new RedisRiskEventStore(new FakeRedisClient());
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'github', timestamp: NOW });
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-b', providerId: 'discord', timestamp: NOW + 1000 });
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'linkedin', timestamp: NOW + 2000 });

    const subjects = await store.distinctSubjectsForFingerprint('fp-1', 60_000, NOW + 2000);
    expect(subjects.sort()).toEqual(['wallet-a', 'wallet-b']);
  });

  it('excludes subjects outside the trailing window', async () => {
    const store = new RedisRiskEventStore(new FakeRedisClient());
    await store.record({ fingerprint: 'fp-2', subject: 'wallet-old', providerId: 'github', timestamp: NOW });
    await store.record({ fingerprint: 'fp-2', subject: 'wallet-new', providerId: 'github', timestamp: NOW + 120_000 });

    const subjects = await store.distinctSubjectsForFingerprint('fp-2', 60_000, NOW + 120_000);
    expect(subjects).toEqual(['wallet-new']);
  });

  it('keeps different fingerprints independent', async () => {
    const store = new RedisRiskEventStore(new FakeRedisClient());
    await store.record({ fingerprint: 'fp-a', subject: 'wallet-1', providerId: 'github', timestamp: NOW });
    await store.record({ fingerprint: 'fp-b', subject: 'wallet-2', providerId: 'github', timestamp: NOW });

    expect(await store.distinctSubjectsForFingerprint('fp-a', 60_000, NOW)).toEqual(['wallet-1']);
    expect(await store.distinctSubjectsForFingerprint('fp-b', 60_000, NOW)).toEqual(['wallet-2']);
  });

  it('returns completion timestamps for a subject, ordered by time, within the window', async () => {
    const store = new RedisRiskEventStore(new FakeRedisClient());
    await store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'github', timestamp: NOW + 500 });
    await store.record({ fingerprint: 'fp-2', subject: 'wallet-a', providerId: 'discord', timestamp: NOW });

    const timestamps = await store.timestampsForSubject('wallet-a', 60_000, NOW + 500);
    expect(timestamps).toEqual([NOW, NOW + 500]);
  });

  it('returns distinct subjects observed from an IP within the window, independent of fingerprint', async () => {
    const store = new RedisRiskEventStore(new FakeRedisClient());
    await store.record({
      fingerprint: 'fp-x',
      subject: 'wallet-a',
      providerId: 'github',
      timestamp: NOW,
      ip: '203.0.113.5',
    });
    await store.record({
      fingerprint: 'fp-y',
      subject: 'wallet-b',
      providerId: 'discord',
      timestamp: NOW + 1000,
      ip: '203.0.113.5',
    });

    const subjects = await store.distinctSubjectsForIp('203.0.113.5', 60_000, NOW + 1000);
    expect(subjects.sort()).toEqual(['wallet-a', 'wallet-b']);
  });

  it('returns empty results for a fingerprint/subject that was never recorded', async () => {
    const store = new RedisRiskEventStore(new FakeRedisClient());
    expect(await store.distinctSubjectsForFingerprint('never-seen', 60_000, NOW)).toEqual([]);
    expect(await store.timestampsForSubject('never-seen', 60_000, NOW)).toEqual([]);
  });

  it('caps entries per key at 500, keeping the most recent', async () => {
    const store = new RedisRiskEventStore(new FakeRedisClient());
    const fingerprint = 'fp-flood';

    for (let i = 0; i < 520; i++) {
      await store.record({ fingerprint, subject: `wallet-${i}`, providerId: 'github', timestamp: NOW + i });
    }

    const subjects = await store.distinctSubjectsForFingerprint(fingerprint, 24 * 60 * 60 * 1000, NOW + 520);
    expect(subjects.length).toBeLessThanOrEqual(500);
    expect(subjects).toContain('wallet-519');
    expect(subjects).not.toContain('wallet-0');
  });
});
