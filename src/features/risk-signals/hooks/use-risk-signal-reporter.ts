"use client";

import { useCallback } from 'react';

import { useWalletStore } from '@/features/wallet/store/wallet-store';

import { getDeviceFingerprint } from '../services/fingerprint';

/**
 * Fires a best-effort report to the internal risk-signal ingestion endpoint
 * whenever a provider verification completes. Mirrors how
 * `use-oauth-provider.ts` calls `useAuditLogStore().appendEntry` on success
 * — same "cross-cutting write alongside the completion" shape, separate
 * concern.
 *
 * Skips silently if no wallet is connected — there's no durable subject to
 * correlate against yet — and never throws or surfaces failures to the
 * verification UX: this is telemetry, not a gate on the user's flow.
 */
export function useRiskSignalReporter() {
  const subject = useWalletStore((state) => state.publicKey);

  return useCallback(
    async (providerId: string, extra?: { phone?: string }) => {
      if (!subject) return;

      try {
        const fingerprint = await getDeviceFingerprint();
        if (!fingerprint) return;

        await fetch('/api/internal/risk-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, fingerprint, providerId, phone: extra?.phone }),
          keepalive: true,
        });
      } catch {
        // Best-effort only — never block or surface in the verification UI.
      }
    },
    [subject],
  );
}
