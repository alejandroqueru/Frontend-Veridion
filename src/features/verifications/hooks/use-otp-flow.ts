"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { OtpStep, ContactChannel } from '../types/otp.types';
import { OTP_CONFIG } from '../constants/contact-verifications';
import { useVerificationStore, type VerificationType } from '../store/verification-store';
import { generateNonce } from '../utils/nonce';
import { useRiskSignalReporter } from '@/features/risk-signals/hooks/use-risk-signal-reporter';

interface UseOtpFlowOptions {
  /** Identifies this flow's slot in the shared verification machine — 'phone-verification' | 'email-verification'. */
  providerId: VerificationType;
  channel: ContactChannel;
  identifier: string;
  wallet?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useOtpFlow({ providerId, channel, identifier, wallet, onSuccess, onError }: UseOtpFlowOptions) {
  const dispatchMachineEvent = useVerificationStore((state) => state.dispatchMachineEvent);
  const getMachineState = useVerificationStore((state) => state.getMachineState);
  const reportRiskSignal = useRiskSignalReporter();

  // Resumability: if a code was already sent (machine still pending_external
  // from a previous mount — e.g. the user closed the modal or the tab after
  // requesting a code, then came back), land directly on the 'code' step
  // instead of silently resetting to 'input'. The code itself is never
  // persisted (it's server-side, TTL'd, and re-entering it is one keystroke
  // away), but the fact that one is already in flight is worth keeping.
  const [step, setStep] = useState<OtpStep>(() =>
    getMachineState(providerId).status === 'pending_external' ? 'code' : 'input',
  );
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(OTP_CONFIG.resendCooldownSeconds);
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /**
   * `CONNECT` is only a valid transition from `idle`; a retried send/verify
   * after a prior failure starts from `failed`, which only accepts
   * `RETRY`/`RESET`. This normalizes either starting point into
   * `connecting` before the request fires, so the follow-up `FAIL`/
   * `AWAIT_EXTERNAL` dispatch is always a valid transition.
   */
  const beginAttempt = useCallback(() => {
    const current = getMachineState(providerId);
    if (current.status === 'failed') {
      dispatchMachineEvent(providerId, { type: 'RETRY' });
    } else if (current.status === 'idle') {
      dispatchMachineEvent(providerId, { type: 'CONNECT' });
    }
  }, [providerId, getMachineState, dispatchMachineEvent]);

  const sendCode = useCallback(async () => {
    setLoading(true);
    setError('');
    beginAttempt();
    try {
      const res = await fetch(`/verifications/${channel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          [channel]: identifier,
          wallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? 'Failed to send code.';
        setError(message);
        dispatchMachineEvent(providerId, { type: 'FAIL', error: message });
        onError?.(message);
        return;
      }
      setStep('code');
      dispatchMachineEvent(providerId, { type: 'AWAIT_EXTERNAL', nonce: generateNonce(), context: { channel } });
      startCooldown();
    } catch {
      const message = 'Network error. Please try again.';
      setError(message);
      dispatchMachineEvent(providerId, { type: 'FAIL', error: message });
    } finally {
      setLoading(false);
    }
  }, [providerId, channel, identifier, wallet, onError, startCooldown, dispatchMachineEvent, beginAttempt]);

  const verifyCode = useCallback(async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    beginAttempt();
    try {
      const res = await fetch(`/verifications/${channel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          [channel]: identifier,
          code,
          wallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? 'Verification failed.';
        setError(message);
        dispatchMachineEvent(providerId, { type: 'FAIL', error: message });
        onError?.(message);
        return;
      }
      setStep('done');
      void reportRiskSignal(providerId, channel === 'phone' ? { phone: identifier } : undefined);
      onSuccess?.();
    } catch {
      const message = 'Network error. Please try again.';
      setError(message);
      dispatchMachineEvent(providerId, { type: 'FAIL', error: message });
    } finally {
      setLoading(false);
    }
  }, [providerId, channel, code, identifier, wallet, onSuccess, onError, dispatchMachineEvent, beginAttempt, reportRiskSignal]);

  const reset = useCallback(() => {
    setStep('input');
    setCode('');
    setError('');
    dispatchMachineEvent(providerId, { type: 'RESET' });
  }, [providerId, dispatchMachineEvent]);

  return { step, code, setCode, loading, error, cooldown, sendCode, verifyCode, reset };
}
