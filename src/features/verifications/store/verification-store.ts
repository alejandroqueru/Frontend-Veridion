import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hasLegacyPoints, type VerificationEvent } from '@/features/scoring/types';
import { selectActiveEvents } from '@/features/scoring/engine';
import { CURRENT_ALGORITHM_VERSION } from '@/features/scoring/schema';
import {
  isLegacyPersistedState,
  migrateLegacyStateToEvents,
  type LegacyPersistedState,
} from '@/features/scoring/legacy';
import {
  createInitialMachineState,
  isStalePending,
  verificationMachineReducer,
  type VerificationMachineEvent,
  type VerificationMachineState,
} from '../machine/verification-machine';

export type VerificationType =
  | 'google'
  | 'github'
  | 'linkedin'
  | 'discord'
  | 'government-id'
  | 'binance'
  | 'phone-verification'
  | 'email-verification'
  | 'biometrics'
  | 'proof-clean-hands'
  | 'stellar-transactions';

export interface VerificationStatus {
  id: VerificationType;
  type: 'social' | 'physical' | 'blockchain';
  completed: boolean;
  completedAt?: Date;
  points: number;
}

/**
 * The score itself now lives entirely in `@/features/scoring` (a pure,
 * versioned engine reading this store's `events`). This store's job is
 * verification UX state — recording append-only events and exposing a
 * back-compat `completedVerifications` read shape for components that
 * predate the scoring engine. It intentionally has no `totalPoints` field:
 * every displayed Human Score comes from `useScoreExplanation()`, never
 * from here directly.
 */
export interface VerificationState {
  events: VerificationEvent[];
  completedVerifications: Record<string, VerificationStatus>;
  /**
   * In-flight UX lifecycle per provider (idle/connecting/pending_external/
   * verified/failed) — this is what makes an interrupted OAuth redirect or
   * OTP round-trip resumable after the browser is closed and reopened.
   * Kept separate from `events` (the scoring source of truth): a provider
   * moves out of `machines` back to `idle` once its completion is recorded
   * as an event, since `completedVerifications`/`events` become the
   * canonical "verified" answer at that point.
   */
  machines: Record<string, VerificationMachineState>;

  /** General entry point — records an event with an arbitrary payload (e.g. a normalized Stellar SignalBundle). */
  recordVerificationEvent: (id: VerificationType, category: VerificationStatus['type'], rawPayload: unknown) => void;
  /** Back-compat convenience for simple/declared-point providers — wraps recordVerificationEvent. */
  completeVerification: (id: VerificationType, type: VerificationStatus['type'], points: number) => void;
  resetVerification: (id: VerificationType) => void;
  resetAllVerifications: () => void;
  isVerificationCompleted: (id: VerificationType) => boolean;
  getVerificationStatus: (id: VerificationType) => VerificationStatus | null;

  /** Dispatches a lifecycle event to a single provider's machine instance. */
  dispatchMachineEvent: (id: VerificationType, event: VerificationMachineEvent) => void;
  /** Reads a provider's current machine state, defaulting to idle (and clearing stale pending_external attempts). */
  getMachineState: (id: VerificationType) => VerificationMachineState;
}

function deriveCompletedVerifications(events: VerificationEvent[]): Record<string, VerificationStatus> {
  const active = selectActiveEvents(events);
  const result: Record<string, VerificationStatus> = {};

  for (const [providerId, event] of active) {
    result[providerId] = {
      id: providerId as VerificationType,
      type: event.category as VerificationStatus['type'],
      completed: true,
      completedAt: new Date(event.occurredAt),
      points: hasLegacyPoints(event.rawPayload) ? event.rawPayload.legacyPoints : 0,
    };
  }

  return result;
}

function makeEventId(providerId: string): string {
  return `${providerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

interface PersistedShape {
  events: VerificationEvent[];
  machines: Record<string, VerificationMachineState>;
}

/**
 * Drops any machine that is verified/idle (redundant with `events`) and any
 * pending_external attempt old enough to be considered abandoned, so a
 * long-dead redirect doesn't show as "waiting" forever. Called both on
 * migration and on every rehydration.
 */
function sanitizeMachines(
  machines: Record<string, VerificationMachineState> | undefined,
  now: number,
): Record<string, VerificationMachineState> {
  const result: Record<string, VerificationMachineState> = {};
  for (const [id, machine] of Object.entries(machines ?? {})) {
    if (!machine || machine.status === 'idle' || machine.status === 'verified') continue;
    if (isStalePending(machine, now)) continue;
    result[id] = machine;
  }
  return result;
}

/**
 * Extracted as a standalone pure function so it's directly unit-testable
 * against raw legacy-shaped and already-migrated fixtures, without
 * instantiating the full Zustand store (which would need a localStorage
 * shim in a non-DOM test environment).
 */
export function migrateVerificationStorage(
  persisted: unknown,
  version: number,
): {
  events: VerificationEvent[];
  completedVerifications: Record<string, VerificationStatus>;
  machines: Record<string, VerificationMachineState>;
} {
  const events =
    (version ?? 0) < 2
      ? isLegacyPersistedState(persisted)
        ? migrateLegacyStateToEvents(persisted as LegacyPersistedState)
        : []
      : ((persisted as Partial<PersistedShape> | undefined)?.events ?? []);

  const machines =
    (version ?? 0) < 3 ? {} : sanitizeMachines((persisted as Partial<PersistedShape> | undefined)?.machines, Date.now());

  return { events, completedVerifications: deriveCompletedVerifications(events), machines };
}

export const useVerificationStore = create<VerificationState>()(
  persist(
    (set, get) => ({
      events: [],
      completedVerifications: {},
      machines: {},

      recordVerificationEvent: (id, category, rawPayload) => {
        const event: VerificationEvent = {
          eventId: makeEventId(id),
          providerId: id,
          category,
          occurredAt: Date.now(),
          algorithmVersionAtCapture: CURRENT_ALGORITHM_VERSION,
          rawPayload,
          source: 'live',
        };
        const events = [...get().events, event];
        const machines = { ...get().machines };
        delete machines[id];
        set({ events, completedVerifications: deriveCompletedVerifications(events), machines });
      },

      completeVerification: (id, type, points) => {
        get().recordVerificationEvent(id, type, { legacyPoints: points });
      },

      resetVerification: (id) => {
        const events = get().events.filter((event) => event.providerId !== id);
        const machines = { ...get().machines };
        delete machines[id];
        set({ events, completedVerifications: deriveCompletedVerifications(events), machines });
      },

      resetAllVerifications: () => {
        set({ events: [], completedVerifications: {}, machines: {} });
      },

      isVerificationCompleted: (id) => {
        return Boolean(get().completedVerifications[id]?.completed);
      },

      getVerificationStatus: (id) => {
        return get().completedVerifications[id] ?? null;
      },

      dispatchMachineEvent: (id, event) => {
        const current = get().machines[id] ?? createInitialMachineState();
        const next = verificationMachineReducer(current, event);
        const machines = { ...get().machines };
        if (next.status === 'idle') {
          delete machines[id];
        } else {
          machines[id] = next;
        }
        set({ machines });
      },

      getMachineState: (id) => {
        if (get().isVerificationCompleted(id)) {
          return { ...createInitialMachineState(), status: 'verified' };
        }
        const machine = get().machines[id];
        if (!machine) return createInitialMachineState();
        if (isStalePending(machine)) return createInitialMachineState();
        return machine;
      },
    }),
    {
      name: 'verification-storage',
      version: 3,
      migrate: migrateVerificationStorage,
      partialize: (state): PersistedShape => ({ events: state.events, machines: state.machines }),
      // `migrate` only runs on a version mismatch — a same-version reload
      // skips straight to a shallow merge, which would leave
      // `completedVerifications` at its initial `{}` value since it's
      // deliberately excluded from `partialize`. Recomputing it here on
      // every rehydration (migrated or not) keeps it always in sync with
      // `events`, the single source of truth. `machines` is sanitized the
      // same way so a long-abandoned pending_external doesn't survive
      // forever across reloads.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.completedVerifications = deriveCompletedVerifications(state.events);
          state.machines = sanitizeMachines(state.machines, Date.now());
        }
      },
    },
  ),
);
