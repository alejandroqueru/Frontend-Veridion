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

  it('defaults machines to {} when migrating from a pre-v3 payload (no resumable state existed yet)', () => {
    const migrated = migrateVerificationStorage({ events: [] }, 2);
    expect(migrated.machines).toEqual({});
  });

  it('carries over a fresh pending_external machine from a v3 payload', () => {
    const payload = {
      events: [],
      machines: {
        github: {
          status: 'pending_external',
          nonce: 'abc',
          startedAt: Date.now(),
          retryCount: 0,
          error: null,
          context: {},
        },
      },
    };
    const migrated = migrateVerificationStorage(payload, 3);
    expect(migrated.machines.github?.status).toBe('pending_external');
    expect(migrated.machines.github?.nonce).toBe('abc');
  });

  it('drops a stale (long-abandoned) pending_external machine on migration', () => {
    const payload = {
      events: [],
      machines: {
        discord: {
          status: 'pending_external',
          nonce: 'old',
          startedAt: Date.now() - 60 * 60 * 1000,
          retryCount: 0,
          error: null,
          context: {},
        },
      },
    };
    const migrated = migrateVerificationStorage(payload, 3);
    expect(migrated.machines.discord).toBeUndefined();
  });

  it('drops idle/verified machines on migration since they carry no resumable information', () => {
    const payload = {
      events: [],
      machines: {
        linkedin: { status: 'idle', nonce: null, startedAt: null, retryCount: 0, error: null, context: {} },
        google: { status: 'verified', nonce: null, startedAt: null, retryCount: 0, error: null, context: {} },
      },
    };
    const migrated = migrateVerificationStorage(payload, 3);
    expect(migrated.machines).toEqual({});
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
