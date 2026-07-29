import { describe, expect, it } from 'vitest';

import { InMemoryRiskEventStore } from '../risk-event-store';

const NOW = 1_700_000_000_000;

describe('InMemoryRiskEventStore', () => {
  it('returns distinct subjects observed under a fingerprint within the window', () => {
    const store = new InMemoryRiskEventStore();
    store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'github', timestamp: NOW });
    store.record({ fingerprint: 'fp-1', subject: 'wallet-b', providerId: 'discord', timestamp: NOW + 1000 });
    store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'linkedin', timestamp: NOW + 2000 });

    const subjects = store.distinctSubjectsForFingerprint('fp-1', 60_000, NOW + 2000);
    expect(subjects.sort()).toEqual(['wallet-a', 'wallet-b']);
  });

  it('excludes subjects outside the trailing window', () => {
    const store = new InMemoryRiskEventStore();
    store.record({ fingerprint: 'fp-2', subject: 'wallet-old', providerId: 'github', timestamp: NOW });
    store.record({ fingerprint: 'fp-2', subject: 'wallet-new', providerId: 'github', timestamp: NOW + 120_000 });

    const subjects = store.distinctSubjectsForFingerprint('fp-2', 60_000, NOW + 120_000);
    expect(subjects).toEqual(['wallet-new']);
  });

  it('keeps different fingerprints independent', () => {
    const store = new InMemoryRiskEventStore();
    store.record({ fingerprint: 'fp-a', subject: 'wallet-1', providerId: 'github', timestamp: NOW });
    store.record({ fingerprint: 'fp-b', subject: 'wallet-2', providerId: 'github', timestamp: NOW });

    expect(store.distinctSubjectsForFingerprint('fp-a', 60_000, NOW)).toEqual(['wallet-1']);
    expect(store.distinctSubjectsForFingerprint('fp-b', 60_000, NOW)).toEqual(['wallet-2']);
  });

  it('returns completion timestamps for a subject within the window', () => {
    const store = new InMemoryRiskEventStore();
    store.record({ fingerprint: 'fp-1', subject: 'wallet-a', providerId: 'github', timestamp: NOW });
    store.record({ fingerprint: 'fp-2', subject: 'wallet-a', providerId: 'discord', timestamp: NOW + 500 });
    store.record({ fingerprint: 'fp-3', subject: 'wallet-a', providerId: 'linkedin', timestamp: NOW + 10 * 60 * 1000 });

    // Queried after all three, with a window wide enough to reach back to the first two.
    const wide = store.timestampsForSubject('wallet-a', 11 * 60 * 1000, NOW + 10 * 60 * 1000);
    expect(wide).toEqual([NOW, NOW + 500, NOW + 10 * 60 * 1000]);

    // Same query point, narrower window: only the most recent one qualifies.
    const narrow = store.timestampsForSubject('wallet-a', 60_000, NOW + 10 * 60 * 1000);
    expect(narrow).toEqual([NOW + 10 * 60 * 1000]);
  });

  it('returns empty results for a fingerprint/subject that was never recorded', () => {
    const store = new InMemoryRiskEventStore();
    expect(store.distinctSubjectsForFingerprint('never-seen', 60_000, NOW)).toEqual([]);
    expect(store.timestampsForSubject('never-seen', 60_000, NOW)).toEqual([]);
  });
});
