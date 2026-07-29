'use client';

import { useEffect } from 'react';
import { useVerificationStore } from '@/features/verifications/store/verification-store';
import { useAuditLogStore } from './audit-log-store';
import { applyRetentionPolicies } from './retention-engine';
import { RETENTION_POLICIES } from './retention-config';

/**
 * Mounts inside DashboardLayout and runs the retention engine on every
 * dashboard load. Any verification events that have exceeded their
 * configured retention window are removed via the store's cascade-safe
 * resetVerification(), and a 'purge' audit entry is appended for each
 * affected category.
 *
 * This hook:
 *   - reads events once on mount (not on every re-render)
 *   - only triggers store mutations when there is actually something to purge
 *   - appends a single 'purge' audit entry summarising all removed events
 *     rather than one entry per event (avoids audit log bloat)
 */
export function useRetentionEnforcement(): void {
  const resetVerification = useVerificationStore((s) => s.resetVerification);
  const appendEntry = useAuditLogStore((s) => s.appendEntry);

  useEffect(() => {
    const events = useVerificationStore.getState().events;
    const now = Date.now();

    const { purged } = applyRetentionPolicies(events, RETENTION_POLICIES, now);

    if (purged.length === 0) return;

    // Group by providerId to call resetVerification once per provider
    const providerIds = [...new Set(purged.map((e) => e.providerId))];
    for (const providerId of providerIds) {
      resetVerification(
        providerId as Parameters<typeof resetVerification>[0],
      );
    }

    // Append a single summarising audit entry
    appendEntry('purge', {
      purgedProviderIds: providerIds,
      purgedEventCount: purged.length,
      ranAt: new Date(now).toISOString(),
      reason: 'retention-policy-expired',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only — retention check runs once per page load
}
