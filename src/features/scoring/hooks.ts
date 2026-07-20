'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVerificationStore } from '@/features/verifications/store/verification-store';
import { computeScoreExplanation } from './engine';
import { getSchema, CURRENT_ALGORITHM_VERSION } from './schema';
import { toLegacySummary, type VerificationSummary } from './legacy';
import type { AlgorithmVersion, ScoreExplanation, VerificationEvent } from './types';

function emptyExplanation(version: AlgorithmVersion): ScoreExplanation {
  return {
    algorithmVersion: version,
    computedAt: 0,
    totalScore: 0,
    categories: [],
    history: [],
    warnings: [],
  };
}

/**
 * The single read path for the Human Score. Hydration-safe (mirrors the
 * old useVerificationSummary pattern) so SSR/first-paint never shows a
 * mismatched number before localStorage is available. No background
 * timer — decay is simply recomputed whenever `events` changes or the
 * component re-renders.
 */
export function useScoreExplanation(algorithmVersion: AlgorithmVersion = CURRENT_ALGORITHM_VERSION): ScoreExplanation {
  const [isHydrated, setIsHydrated] = useState(false);
  const events = useVerificationStore((state) => state.events);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return useMemo(() => {
    if (!isHydrated) return emptyExplanation(algorithmVersion);
    return computeScoreExplanation(events, getSchema(algorithmVersion), Date.now());
  }, [events, isHydrated, algorithmVersion]);
}

/**
 * Drop-in replacement for the old `useVerificationSummary` — same
 * hydration-safe shape, same `VerificationSummary` contract, but every
 * number now comes from the scoring engine instead of a hand-rolled sum.
 */
export function useHumanScoreSummary(): VerificationSummary {
  const [isHydrated, setIsHydrated] = useState(false);
  const events = useVerificationStore((state) => state.events);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return useMemo(() => {
    const schema = getSchema(CURRENT_ALGORITHM_VERSION);
    const explanation = computeScoreExplanation(events, schema, Date.now());
    return toLegacySummary(explanation, schema, isHydrated);
  }, [events, isHydrated]);
}

/**
 * Lets a component preview "what if I verify X" without ever writing to the
 * store — `simulate` runs the engine against real events plus a caller-
 * supplied list of hypothetical ones, purely in memory. Hydration-safe: the
 * baseline uses an empty event list until the store rehydrates from
 * localStorage, matching every other hook in this codebase to avoid an SSR
 * hydration mismatch.
 */
export function useScoreSimulation() {
  const [isHydrated, setIsHydrated] = useState(false);
  const events = useVerificationStore((state) => state.events);
  const schema = getSchema(CURRENT_ALGORITHM_VERSION);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const effectiveEvents = useMemo(() => (isHydrated ? events : []), [isHydrated, events]);

  const baseline = useMemo<ScoreExplanation>(
    () => computeScoreExplanation(effectiveEvents, schema, Date.now()),
    [effectiveEvents, schema],
  );

  const simulate = useCallback(
    (hypotheticalEvents: VerificationEvent[]): ScoreExplanation =>
      computeScoreExplanation([...effectiveEvents, ...hypotheticalEvents], schema, Date.now()),
    [effectiveEvents, schema],
  );

  return { baseline, simulate, isHydrated };
}
