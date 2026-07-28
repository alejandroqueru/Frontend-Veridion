'use client';

import { useMemo } from 'react';
import { useScoreExplanation } from '@/features/scoring/hooks';
import type { AlgorithmVersion } from '@/features/scoring/types';
import { buildPassportSnapshot } from './snapshot';
import type { PassportSnapshot } from './types';

/**
 * The only place the passport feature touches live app state — through the
 * existing hydration-safe `useScoreExplanation` (never the Zustand store
 * directly), then adapted via `buildPassportSnapshot`.
 */
export function usePassportSnapshot(algorithmVersion?: AlgorithmVersion): PassportSnapshot {
  const explanation = useScoreExplanation(algorithmVersion);
  return useMemo(() => buildPassportSnapshot(explanation), [explanation]);
}
