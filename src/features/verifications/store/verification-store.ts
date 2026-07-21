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

  /** General entry point — records an event with an arbitrary payload (e.g. a normalized Stellar SignalBundle). */
  recordVerificationEvent: (id: VerificationType, category: VerificationStatus['type'], rawPayload: unknown) => void;
  /** Back-compat convenience for simple/declared-point providers — wraps recordVerificationEvent. */
  completeVerification: (id: VerificationType, type: VerificationStatus['type'], points: number) => void;
  resetVerification: (id: VerificationType) => void;
  resetAllVerifications: () => void;
  isVerificationCompleted: (id: VerificationType) => boolean;
  getVerificationStatus: (id: VerificationType) => VerificationStatus | null;
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
): { events: VerificationEvent[]; completedVerifications: Record<string, VerificationStatus> } {
  const events =
    (version ?? 0) < 2
      ? isLegacyPersistedState(persisted)
        ? migrateLegacyStateToEvents(persisted as LegacyPersistedState)
        : []
      : ((persisted as Partial<PersistedShape> | undefined)?.events ?? []);

  return { events, completedVerifications: deriveCompletedVerifications(events) };
}

export const useVerificationStore = create<VerificationState>()(
  persist(
    (set, get) => ({
      events: [],
      completedVerifications: {},

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
        set({ events, completedVerifications: deriveCompletedVerifications(events) });
      },

      completeVerification: (id, type, points) => {
        get().recordVerificationEvent(id, type, { legacyPoints: points });
      },

      resetVerification: (id) => {
        const events = get().events.filter((event) => event.providerId !== id);
        set({ events, completedVerifications: deriveCompletedVerifications(events) });
      },

      resetAllVerifications: () => {
        set({ events: [], completedVerifications: {} });
      },

      isVerificationCompleted: (id) => {
        return Boolean(get().completedVerifications[id]?.completed);
      },

      getVerificationStatus: (id) => {
        return get().completedVerifications[id] ?? null;
      },
    }),
    {
      name: 'verification-storage',
      version: 2,
      migrate: migrateVerificationStorage,
      partialize: (state): PersistedShape => ({ events: state.events }),
      // `migrate` only runs on a version mismatch — a same-version reload
      // skips straight to a shallow merge, which would leave
      // `completedVerifications` at its initial `{}` value since it's
      // deliberately excluded from `partialize`. Recomputing it here on
      // every rehydration (migrated or not) keeps it always in sync with
      // `events`, the single source of truth.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.completedVerifications = deriveCompletedVerifications(state.events);
        }
      },
    },
  ),
);
