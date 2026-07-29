import type { VerificationEvent } from '@/features/scoring/types';
import type { VerificationStatus } from '@/features/verifications/store/verification-store';

// ── Audit log ────────────────────────────────────────────────────────

export type AuditAction =
  | 'export'      // user downloaded their data
  | 'deletion'    // user requested & completed erasure
  | 'access'      // data was shared with a third party / OAuth provider
  | 'purge';      // retention engine automatically removed expired data

export interface AuditLogEntry {
  /** Monotonically unique, never reused. */
  readonly id: string;
  readonly timestamp: number;
  readonly action: AuditAction;
  /** Free-form human-readable context (provider id, requester name, etc.). */
  readonly details: Readonly<Record<string, unknown>>;
}

// ── Retention policy ─────────────────────────────────────────────────

export type RetentionCategory =
  | 'otp'
  | 'machine-session'
  | 'social'
  | 'physical'
  | 'blockchain'
  | 'audit-log';

export interface RetentionPolicy {
  readonly category: RetentionCategory;
  /** Maps to VerificationEvent.category or a synthetic category. */
  readonly verificationCategory: string | null;
  readonly windowMs: number;
  readonly label: string;
  readonly description: string;
}

// ── Data export ──────────────────────────────────────────────────────

export interface WalletExportData {
  publicKey: string | null;
  walletName: string | null;
  network: 'testnet' | 'mainnet';
}

export interface DataExportPayload {
  schemaVersion: '1.0';
  exportedAt: string;
  subject: {
    walletPublicKey: string | null;
  };
  verificationEvents: VerificationEvent[];
  completedVerifications: Record<string, VerificationStatus>;
  wallet: WalletExportData;
  auditLog: AuditLogEntry[];
}

// ── Deletion ─────────────────────────────────────────────────────────

export interface DeletionReport {
  clearedAt: number;
  storesCleared: string[];
  eventsRemoved: number;
  machinesRemoved: number;
}

// ── Data subject status ──────────────────────────────────────────────

/**
 * Three-way distinction required by the spec:
 * - 'never-verified' : fresh account, no events, no deletion record
 * - 'active'         : has (or had) verification events
 * - 'deleted'        : erasure was requested and completed
 */
export type DataSubjectStatus = 'active' | 'deleted' | 'never-verified';

// ── Purge report (retention engine output) ───────────────────────────

export interface PurgeReport {
  purgedEventIds: string[];
  retainedCount: number;
  ranAt: number;
}
