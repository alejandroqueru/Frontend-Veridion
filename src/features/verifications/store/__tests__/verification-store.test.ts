import { migrateVerificationStorage } from '../verification-store';
import type { LegacyPersistedState } from '@/features/scoring/legacy';

describe('migrateVerificationStorage', () => {
  it('converts a raw legacy-shaped object (version 0/undefined) into events', () => {
    const legacy: LegacyPersistedState = {
      totalPoints: 6,
      completedVerifications: {
        google: {
          id: 'google',
          type: 'social',
          completed: true,
          completedAt: '2025-01-01T00:00:00.000Z',
          points: 6,
        },
      },
    };

    const migrated = migrateVerificationStorage(legacy, 0);
    expect(migrated.events).toHaveLength(1);
    expect(migrated.events[0].providerId).toBe('google');
    expect(migrated.completedVerifications.google?.completed).toBe(true);
    expect(migrated.completedVerifications.google?.points).toBe(6);
  });

  it('treats an undefined version the same as version 0', () => {
    const legacy: LegacyPersistedState = {
      totalPoints: 6,
      completedVerifications: {
        github: { id: 'github', type: 'social', completed: true, points: 6 },
      },
    };
    const migrated = migrateVerificationStorage(legacy, undefined as unknown as number);
    expect(migrated.events).toHaveLength(1);
  });

  it('passes through an already-migrated (version >= 2) events array unchanged', () => {
    const alreadyMigrated = {
      events: [
        {
          eventId: 'e1',
          providerId: 'google',
          category: 'social',
          occurredAt: 1000,
          algorithmVersionAtCapture: 'v1',
          rawPayload: { legacyPoints: 6 },
          source: 'live',
        },
      ],
    };
    const migrated = migrateVerificationStorage(alreadyMigrated, 2);
    expect(migrated.events).toHaveLength(1);
    expect(migrated.events[0].eventId).toBe('e1');
    expect(migrated.completedVerifications.google?.completed).toBe(true);
  });

  it('does not throw and returns an empty state for garbage input', () => {
    expect(() => migrateVerificationStorage(undefined, 0)).not.toThrow();
    expect(() => migrateVerificationStorage(null, 0)).not.toThrow();
    expect(() => migrateVerificationStorage({ unexpected: true }, 0)).not.toThrow();
    expect(migrateVerificationStorage({ unexpected: true }, 0).events).toEqual([]);
  });

  it('recomputes completedVerifications from events rather than trusting any persisted copy', () => {
    const staleShapeWithWrongDerivedData = {
      events: [
        {
          eventId: 'e1',
          providerId: 'github',
          category: 'social',
          occurredAt: 5000,
          algorithmVersionAtCapture: 'v1',
          rawPayload: { legacyPoints: 6 },
          source: 'live',
        },
      ],
      completedVerifications: { someStaleGarbage: { completed: true } },
    };
    const migrated = migrateVerificationStorage(staleShapeWithWrongDerivedData, 2);
    expect(migrated.completedVerifications).not.toHaveProperty('someStaleGarbage');
    expect(migrated.completedVerifications.github?.completed).toBe(true);
  });
});
