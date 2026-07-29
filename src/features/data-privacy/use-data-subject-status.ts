'use client';

import { useAuditLogStore } from './audit-log-store';
import type { DataSubjectStatus } from './types';

/**
 * Reads the data subject's current status from the audit log store.
 *
 * Returns one of three distinct states (as required by the spec):
 *   - 'never-verified' : fresh account — no events, no deletion on record
 *   - 'active'         : has (or had) verification events
 *   - 'deleted'        : erasure was completed; distinct from 'never-verified'
 *                        so deleted accounts are not silently treated as new
 *
 * The status persists across page reloads via the audit-log-storage key.
 */
export function useDataSubjectStatus(): DataSubjectStatus {
  return useAuditLogStore((state) => state.dataSubjectStatus);
}
