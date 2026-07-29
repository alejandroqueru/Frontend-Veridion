import type { VerificationEvent } from '@/features/scoring/types';
import type { VerificationStatus } from '@/features/verifications/store/verification-store';
import type { WalletState } from '@/features/wallet/store/wallet-store';
import type { AuditLogEntry, DataExportPayload, WalletExportData } from './types';

/**
 * Builds the complete data export payload from the current store snapshots.
 *
 * INCLUDED:
 *   - All verification events (providerId, category, occurredAt, algorithmVersionAtCapture)
 *   - Derived completedVerifications map
 *   - Wallet metadata (publicKey, walletName, network)
 *   - The caller's audit log entries
 *
 * EXCLUDED (by design):
 *   - machines{} — ephemeral UX session state, not user data
 *   - Raw OTP codes — server-side in-memory only, never written to localStorage
 *   - rawPayload internals of other users — this function only receives the
 *     current user's own store snapshot, so cross-user leakage is structurally
 *     impossible
 *   - Aggregate/system fraud signals — not stored client-side
 *
 * Pure function — safe to call in tests without mocking stores.
 */
export function buildDataExport(params: {
  events: VerificationEvent[];
  completedVerifications: Record<string, VerificationStatus>;
  walletState: Pick<WalletState, 'publicKey' | 'walletName' | 'network'>;
  auditEntries: readonly AuditLogEntry[];
  now?: number;
}): DataExportPayload {
  const { events, completedVerifications, walletState, auditEntries, now = Date.now() } = params;

  const wallet: WalletExportData = {
    publicKey: walletState.publicKey,
    walletName: walletState.walletName,
    network: walletState.network,
  };

  return {
    schemaVersion: '1.0',
    exportedAt: new Date(now).toISOString(),
    subject: {
      walletPublicKey: walletState.publicKey,
    },
    // Deep-copy events so the exported object is fully independent of the store
    verificationEvents: events.map((e) => ({ ...e })),
    completedVerifications: Object.fromEntries(
      Object.entries(completedVerifications).map(([k, v]) => [k, { ...v }]),
    ),
    wallet,
    // Audit log is already frozen; spread into plain objects for JSON safety
    auditLog: auditEntries.map((e) => ({ ...e, details: { ...e.details } })),
  };
}

/**
 * Triggers a browser file download of the data export as a pretty-printed
 * JSON file. Must be called in a browser context (client component).
 */
export function downloadDataExport(payload: DataExportPayload): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `veridion-data-export-${new Date(payload.exportedAt).toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
