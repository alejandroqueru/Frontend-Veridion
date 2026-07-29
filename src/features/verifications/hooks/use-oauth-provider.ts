"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useVerificationStore, type VerificationType } from '../store/verification-store';
import { generateNonce } from '../utils/nonce';
import { getOAuthRedirectUri } from '../utils/oauth';
import { isInFlight } from '../machine/verification-machine';
import { useMachineState } from './use-machine-state';
import { useAuditLogStore } from '@/features/data-privacy/audit-log-store';
import { useRiskSignalReporter } from '@/features/risk-signals/hooks/use-risk-signal-reporter';

interface BuildAuthorizeUrlParams {
  clientId: string;
  redirectUri: string;
  nonce: string;
}

interface UseOAuthProviderOptions {
  providerId: VerificationType;
  points: number;
  /** Undefined when the NEXT_PUBLIC_*_CLIENT_ID env var isn't configured. */
  clientId: string | undefined;
  buildAuthorizeUrl: (params: BuildAuthorizeUrlParams) => string;
  /** Server route that exchanges the OAuth `code` for the provider's user info, e.g. '/verifications/github'. */
  exchangeEndpoint: string;
  onSuccess?: (user: unknown) => void;
  onError?: (error: unknown) => void;
}

/**
 * Drives a full-page-redirect OAuth flow (GitHub/Discord/LinkedIn) through
 * the shared verification machine, replacing each provider's previous
 * bespoke `useState` + hardcoded `state=<provider>_verification` literal.
 *
 * Resumability: before redirecting, a random per-attempt nonce is generated
 * and persisted (via `dispatchMachineEvent`'s AWAIT_EXTERNAL, which the
 * store writes straight to localStorage) alongside `pending_external`
 * status. If the user closes the browser mid-redirect and comes back later
 * — even in a new tab, even without ever reopening the verification modal —
 * `getMachineState` still reports `pending_external`, and if the provider
 * redirected back with a matching `?code&state=`, the effect below
 * completes the exchange. A `state` that doesn't match the persisted nonce
 * (stale attempt, different provider, tampered link) is ignored rather than
 * trusted, unlike the old hardcoded-literal check.
 */
export function useOAuthProvider({
  providerId,
  points,
  clientId,
  buildAuthorizeUrl,
  exchangeEndpoint,
  onSuccess,
  onError,
}: UseOAuthProviderOptions) {
  const dispatchMachineEvent = useVerificationStore((state) => state.dispatchMachineEvent);
  const completeVerification = useVerificationStore((state) => state.completeVerification);
  const isVerificationCompleted = useVerificationStore((state) => state.isVerificationCompleted);
  const machine = useMachineState(providerId);
  const appendAuditEntry = useAuditLogStore((state) => state.appendEntry);
  const reportRiskSignal = useRiskSignalReporter();
  const handledCallbackRef = useRef(false);

  const exchange = useCallback(
    async (code: string) => {
      try {
        const response = await fetch(exchangeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error ?? `Failed to authenticate with ${providerId}`);
        }

        const data = await response.json();
        completeVerification(providerId, 'social', points);
        dispatchMachineEvent(providerId, { type: 'SUCCEED' });
        // Record that this provider was granted access to the user's identity
        appendAuditEntry('access', {
          providerId,
          source: 'oauth',
          grantedAt: new Date().toISOString(),
        });
        void reportRiskSignal(providerId);
        onSuccess?.(data.user);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to authenticate with ${providerId}`;
        dispatchMachineEvent(providerId, { type: 'FAIL', error: message });
        onError?.(error);
      }
    },
    [providerId, points, exchangeEndpoint, completeVerification, dispatchMachineEvent, onSuccess, onError, appendAuditEntry, reportRiskSignal],
  );

  useEffect(() => {
    if (handledCallbackRef.current) return;
    if (isVerificationCompleted(providerId)) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;

    const current = useVerificationStore.getState().getMachineState(providerId);
    if (current.status !== 'pending_external' || current.nonce !== state) {
      // Not our redirect (different provider, stale/tampered attempt, or no
      // in-flight attempt recorded) — don't touch it, another provider's
      // effect or a future load may still need these query params.
      return;
    }

    handledCallbackRef.current = true;
    void exchange(code);
    // Intentionally run once per mount — re-running on every dependency
    // change would re-trigger on the AWAIT_EXTERNAL state update we cause
    // ourselves via `exchange`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, isVerificationCompleted]);

  const start = useCallback(() => {
    if (!clientId) {
      dispatchMachineEvent(providerId, { type: 'CONNECT' });
      dispatchMachineEvent(providerId, { type: 'FAIL', error: `${providerId} client ID not configured` });
      onError?.(`${providerId} client ID not configured`);
      return;
    }

    const nonce = generateNonce();
    const redirectUri = getOAuthRedirectUri();

    // CONNECT then AWAIT_EXTERNAL: from `idle` both apply in sequence; from
    // an already-`connecting` state (the RETRY path below moves there first)
    // the CONNECT dispatch is a harmless no-op since it's not a valid
    // transition from `connecting` — either way we land in
    // `pending_external` with a fresh nonce before the browser navigates
    // away, so it's the last thing persisted before the redirect fires.
    dispatchMachineEvent(providerId, { type: 'CONNECT' });
    dispatchMachineEvent(providerId, { type: 'AWAIT_EXTERNAL', nonce, context: { redirectUri } });

    window.location.href = buildAuthorizeUrl({ clientId, redirectUri, nonce });
  }, [clientId, providerId, buildAuthorizeUrl, dispatchMachineEvent, onError]);

  const retry = useCallback(() => {
    dispatchMachineEvent(providerId, { type: 'RETRY' });
    start();
  }, [providerId, dispatchMachineEvent, start]);

  const reset = useCallback(() => {
    dispatchMachineEvent(providerId, { type: 'RESET' });
  }, [providerId, dispatchMachineEvent]);

  return {
    status: machine.status,
    error: machine.error,
    isInFlight: isInFlight(machine.status),
    start,
    retry,
    reset,
  };
}
