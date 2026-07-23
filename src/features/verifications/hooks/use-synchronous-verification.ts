"use client";

import { useCallback } from 'react';
import { useVerificationStore, type VerificationType } from '../store/verification-store';
import { isInFlight } from '../machine/verification-machine';
import { useMachineState } from './use-machine-state';

/**
 * Plugs a verification method that never leaves the page (Google's
 * Identity Services popup, Stellar's direct API call, the mocked Physical
 * Verification adapters) into the same shared lifecycle machine as the
 * OAuth-redirect providers, without any of the nonce/resume machinery those
 * need — there's no external navigation to resume after here.
 */
export function useSynchronousVerification(providerId: VerificationType) {
  const dispatchMachineEvent = useVerificationStore((state) => state.dispatchMachineEvent);
  const machine = useMachineState(providerId);

  const begin = useCallback(() => {
    dispatchMachineEvent(providerId, { type: 'CONNECT' });
  }, [providerId, dispatchMachineEvent]);

  const succeed = useCallback(() => {
    dispatchMachineEvent(providerId, { type: 'SUCCEED' });
  }, [providerId, dispatchMachineEvent]);

  const fail = useCallback(
    (error: string) => {
      dispatchMachineEvent(providerId, { type: 'FAIL', error });
    },
    [providerId, dispatchMachineEvent],
  );

  const retry = useCallback(() => {
    dispatchMachineEvent(providerId, { type: 'RETRY' });
  }, [providerId, dispatchMachineEvent]);

  const reset = useCallback(() => {
    dispatchMachineEvent(providerId, { type: 'RESET' });
  }, [providerId, dispatchMachineEvent]);

  return {
    status: machine.status,
    error: machine.error,
    isInFlight: isInFlight(machine.status),
    begin,
    succeed,
    fail,
    retry,
    reset,
  };
}
