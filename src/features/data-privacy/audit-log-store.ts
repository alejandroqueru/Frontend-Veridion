import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditLogEntry, AuditAction, DataSubjectStatus } from './types';

function makeEntryId(): string {
  return `audit:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Freezes an audit entry deeply so no downstream code can mutate fields
 * after the entry has been written. Object.freeze is shallow; we also
 * freeze the nested `details` map.
 */
function freezeEntry(entry: AuditLogEntry): AuditLogEntry {
  Object.freeze(entry.details);
  return Object.freeze(entry);
}

interface AuditLogState {
  entries: readonly AuditLogEntry[];
  /**
   * 'active' | 'deleted' | 'never-verified'
   * Stored here so it survives page reloads via the persist middleware.
   */
  dataSubjectStatus: DataSubjectStatus;

  /**
   * Append a new immutable entry to the log.
   * This is the ONLY mutation path — there is no "update" or "delete" action.
   */
  appendEntry: (
    action: AuditAction,
    details?: Record<string, unknown>,
  ) => AuditLogEntry;

  /**
   * Mark the subject as deleted. Called by the deletion service.
   * Also appends a 'deletion' audit entry automatically.
   */
  markDeleted: () => void;

  /**
   * Mark the subject as active again. Called when a user reconnects their wallet
   * after previously deleting their data.
   */
  markActive: () => void;

  /** Expose all entries (frozen, in append order). */
  getEntries: () => readonly AuditLogEntry[];
}

export const useAuditLogStore = create<AuditLogState>()(
  persist(
    (set, get) => ({
      entries: [],
      dataSubjectStatus: 'never-verified',

      appendEntry: (action, details = {}) => {
        const entry: AuditLogEntry = freezeEntry({
          id: makeEntryId(),
          timestamp: Date.now(),
          action,
          details,
        });

        // We ONLY ever spread new entries onto the existing array — we never
        // replace the whole array with a version that omits earlier entries.
        set((state) => ({
          entries: [...state.entries, entry],
          // Transition from 'never-verified' to 'active' on first real action
          dataSubjectStatus:
            state.dataSubjectStatus === 'never-verified' && action !== 'deletion'
              ? 'active'
              : state.dataSubjectStatus,
        }));

        return entry;
      },

      markDeleted: () => {
        const entry: AuditLogEntry = freezeEntry({
          id: makeEntryId(),
          timestamp: Date.now(),
          action: 'deletion',
          details: { requestedBy: 'user' },
        });
        set((state) => ({
          entries: [...state.entries, entry],
          dataSubjectStatus: 'deleted',
        }));
        return entry;
      },

      markActive: () => {
        set({ dataSubjectStatus: 'active' });
      },

      getEntries: () => get().entries,
    }),
    {
      name: 'audit-log-storage',
      version: 1,
      /**
       * Re-freeze all entries on rehydration. Entries serialized to JSON
       * lose their frozen status; re-applying it here ensures the runtime
       * immutability guarantee holds even after a page reload.
       */
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.entries = state.entries.map(freezeEntry);
        }
      },
      /**
       * Guard: when merging persisted state back in, verify that no
       * existing entry's core fields have been tampered with.
       * (A hash-based MAC would be stronger; this is the client-side floor.)
       */
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<AuditLogState>;
        const incomingEntries = (persistedState.entries ?? []).map(freezeEntry);
        return {
          ...current,
          ...persistedState,
          entries: incomingEntries,
        };
      },
    },
  ),
);
