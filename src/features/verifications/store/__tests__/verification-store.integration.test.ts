// @vitest-environment jsdom
import { beforeEach, vi } from 'vitest';

/**
 * Exercises the REAL Zustand `create(persist(...))` store against real
 * `localStorage` — unlike verification-store.test.ts (which tests the
 * extracted `migrateVerificationStorage` function in isolation), this
 * proves the actual wiring (storage key, version, migrate, partialize)
 * works end-to-end, the way a real browser session would hit it.
 */
describe('useVerificationStore — real persist/localStorage integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('migrates a seeded legacy localStorage payload and the engine reproduces the original total', async () => {
    const legacyPayload = {
      state: {
        totalPoints: 6 + 500,
        completedVerifications: {
          google: {
            id: 'google',
            type: 'social',
            completed: true,
            completedAt: '2025-06-01T10:00:00.000Z',
            points: 6,
          },
          'email-verification': {
            id: 'email-verification',
            type: 'physical',
            completed: true,
            completedAt: '2025-06-02T10:00:00.000Z',
            points: 500,
          },
        },
      },
      version: 0,
    };
    localStorage.setItem('verification-storage', JSON.stringify(legacyPayload));

    const { useVerificationStore } = await import('../verification-store');
    const { computeScoreExplanation } = await import('@/features/scoring/engine');
    const { getSchema, CURRENT_ALGORITHM_VERSION } = await import('@/features/scoring/schema');

    const state = useVerificationStore.getState();
    expect(state.events).toHaveLength(2);
    expect(state.isVerificationCompleted('google')).toBe(true);
    expect(state.isVerificationCompleted('email-verification')).toBe(true);

    const explanation = computeScoreExplanation(state.events, getSchema(CURRENT_ALGORITHM_VERSION), Date.now());
    expect(explanation.totalScore).toBe(506);
  });

  it('a fresh (no localStorage) session starts with zero events', async () => {
    const { useVerificationStore } = await import('../verification-store');
    expect(useVerificationStore.getState().events).toHaveLength(0);
    expect(useVerificationStore.getState().isVerificationCompleted('google')).toBe(false);
  });

  it('recording a verification appends an event and persists it to localStorage', async () => {
    const { useVerificationStore } = await import('../verification-store');
    useVerificationStore.getState().completeVerification('github', 'social', 6);

    expect(useVerificationStore.getState().events).toHaveLength(1);
    expect(useVerificationStore.getState().isVerificationCompleted('github')).toBe(true);

    const persisted = JSON.parse(localStorage.getItem('verification-storage') ?? '{}');
    expect(persisted.state.events).toHaveLength(1);
    expect(persisted.version).toBe(3);
  });

  it('re-verifying an existing provider appends a new event instead of no-op-ing (fixes the old bug)', async () => {
    const { useVerificationStore } = await import('../verification-store');
    useVerificationStore.getState().completeVerification('github', 'social', 6);
    useVerificationStore.getState().completeVerification('github', 'social', 6);

    expect(useVerificationStore.getState().events).toHaveLength(2);
  });

  it('resuming: a pending_external machine survives a simulated browser close (fresh module import against the same localStorage)', async () => {
    const { useVerificationStore } = await import('../verification-store');

    useVerificationStore.getState().dispatchMachineEvent('github', { type: 'CONNECT' });
    useVerificationStore.getState().dispatchMachineEvent('github', {
      type: 'AWAIT_EXTERNAL',
      nonce: 'resume-nonce',
      context: { redirectUri: 'https://example.com/dashboard' },
    });

    expect(useVerificationStore.getState().getMachineState('github').status).toBe('pending_external');

    // Simulate the browser being closed and reopened: fresh module state,
    // same underlying localStorage.
    vi.resetModules();
    const { useVerificationStore: reloaded } = await import('../verification-store');

    const resumed = reloaded.getState().getMachineState('github');
    expect(resumed.status).toBe('pending_external');
    expect(resumed.nonce).toBe('resume-nonce');
    expect(resumed.context).toEqual({ redirectUri: 'https://example.com/dashboard' });
  });

  it('completing a verification clears any in-flight machine for that provider', async () => {
    const { useVerificationStore } = await import('../verification-store');

    useVerificationStore.getState().dispatchMachineEvent('discord', { type: 'CONNECT' });
    useVerificationStore.getState().dispatchMachineEvent('discord', { type: 'AWAIT_EXTERNAL', nonce: 'n' });
    expect(useVerificationStore.getState().getMachineState('discord').status).toBe('pending_external');

    useVerificationStore.getState().completeVerification('discord', 'social', 6);

    expect(useVerificationStore.getState().getMachineState('discord').status).toBe('verified');
    expect(useVerificationStore.getState().machines.discord).toBeUndefined();
  });

  it('a second session reading the same localStorage sees the already-migrated data without re-migrating', async () => {
    localStorage.setItem(
      'verification-storage',
      JSON.stringify({
        state: {
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
        },
        version: 2,
      }),
    );

    const { useVerificationStore } = await import('../verification-store');
    expect(useVerificationStore.getState().events).toHaveLength(1);
    expect(useVerificationStore.getState().isVerificationCompleted('google')).toBe(true);
  });
});
