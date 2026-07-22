"use client";

import { useEffect, useState } from 'react';
import { useVerificationStore, type VerificationType } from '../store/verification-store';
import type { VerificationLifecycleStatus } from '../machine/verification-machine';
import { useMachineState } from './use-machine-state';

export interface VerificationLifecycle {
  /** idle/connecting/pending_external/verified/failed — 'idle' until hydrated on the client. */
  status: VerificationLifecycleStatus;
  error: string | null;
  completedAt?: Date;
  points: number;
  isHydrated: boolean;
}

/**
 * The single canonical way UI reads a verification method's current state —
 * used by `VerificationCard`, the modal, and anywhere else that used to read
 * `completedVerifications`/`isVerificationCompleted` (a plain boolean) or
 * roll its own `useState` for in-flight status. Combines the machine's
 * in-flight status with the scoring store's completion record so callers
 * never need to reconcile the two themselves.
 *
 * `isHydrated` guards against an SSR/client mismatch: the Zustand `persist`
 * middleware only reads localStorage on the client, so the very first
 * client render must still report the same (unhydrated) state the server
 * rendered before flipping to the real value post-mount.
 */
export function useVerificationLifecycle(providerId: VerificationType): VerificationLifecycle {
  const [isHydrated, setIsHydrated] = useState(false);
  const machine = useMachineState(providerId);
  const completed = useVerificationStore((state) => state.completedVerifications[providerId]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return { status: 'idle', error: null, points: 0, isHydrated: false };
  }

  return {
    status: machine.status,
    error: machine.error,
    completedAt: completed?.completedAt,
    points: completed?.points ?? 0,
    isHydrated: true,
  };
}
