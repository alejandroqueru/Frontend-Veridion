import { useVerificationStore } from '@/features/verifications/store/verification-store';
import { useWalletStore } from '@/features/wallet/store/wallet-store';
import { useAuditLogStore } from './audit-log-store';
import type { DeletionReport } from './types';

/**
 * Cascades a full data deletion across every first-party store holding
 * user data. This is the single authoritative deletion path — nothing
 * else should be calling individual store resets for user-initiated
 * erasure, so the cascade stays complete.
 *
 * Stores cleared:
 *   1. useVerificationStore  → events[], machines{}, completedVerifications
 *      Also calls Zustand persist's clearStorage to wipe the underlying
 *      localStorage key, not just the in-memory state.
 *   2. useWalletStore        → publicKey, walletName, isConnected,
 *      isConnecting — full disconnect per user's explicit request.
 *      Also clears the underlying localStorage key.
 *   3. useAuditLogStore.markDeleted() → sets dataSubjectStatus = 'deleted'
 *      and appends an immutable 'deletion' audit entry.
 *
 * The audit log entries themselves are NEVER deleted (7-year retention
 * floor, regulatory requirement).
 *
 * Returns a DeletionReport describing exactly what was removed, so the
 * confirmation UI can display a truthful summary.
 */
export function cascadeDeleteUserData(): DeletionReport {
  const verificationState = useVerificationStore.getState();
  const eventsRemoved = verificationState.events.length;
  const machinesRemoved = Object.keys(verificationState.machines).length;

  // 1. Clear verification store in-memory state
  verificationState.resetAllVerifications();

  // 2. Wipe the persisted localStorage key for verification-storage.
  //    Zustand's persist middleware exposes clearStorage on the store instance.
  const verificationPersist = (
    useVerificationStore as unknown as { persist: { clearStorage: () => void } }
  ).persist;
  if (verificationPersist?.clearStorage) {
    verificationPersist.clearStorage();
  }

  // 3. Fully disconnect and clear the wallet store
  useWalletStore.getState().disconnect();
  const walletPersist = (
    useWalletStore as unknown as { persist: { clearStorage: () => void } }
  ).persist;
  if (walletPersist?.clearStorage) {
    walletPersist.clearStorage();
  }

  // 4. Mark the data subject as deleted (appends an immutable audit entry)
  useAuditLogStore.getState().markDeleted();

  return {
    clearedAt: Date.now(),
    storesCleared: ['verification-storage', 'wallet-storage'],
    eventsRemoved,
    machinesRemoved,
  };
}
