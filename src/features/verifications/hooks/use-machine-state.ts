"use client";

import { useMemo } from 'react';
import { useVerificationStore, type VerificationType } from '../store/verification-store';
import { createInitialMachineState, isStalePending, type VerificationMachineState } from '../machine/verification-machine';

/**
 * The one safe way to reactively read a provider's machine state in a
 * component. `store.getMachineState(id)` is a plain getter that computes
 * and returns a *new* object on every call (verified-override, idle
 * default, stale-pending reset) — using it directly as a Zustand selector
 * (`useVerificationStore((s) => s.getMachineState(id))`) makes every
 * render produce a referentially-new snapshot, which trips React's
 * `useSyncExternalStore` change detection into an infinite render loop.
 *
 * This hook instead selects the two *raw, stable* store slices
 * (`machines[id]` and `completedVerifications[id]`, which Zustand only
 * gives new references to when they actually change) and only computes the
 * derived object in a `useMemo`, so it's recreated exclusively when the
 * underlying data changes rather than on every render.
 */
export function useMachineState(providerId: VerificationType): VerificationMachineState {
  const rawMachine = useVerificationStore((state) => state.machines[providerId]);
  const isCompleted = useVerificationStore((state) => Boolean(state.completedVerifications[providerId]?.completed));

  return useMemo(() => {
    if (isCompleted) return { ...createInitialMachineState(), status: 'verified' };
    if (!rawMachine) return createInitialMachineState();
    if (isStalePending(rawMachine)) return createInitialMachineState();
    return rawMachine;
  }, [isCompleted, rawMachine]);
}
