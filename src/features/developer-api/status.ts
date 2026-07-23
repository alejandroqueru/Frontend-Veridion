import { computeScoreExplanation } from '@/features/scoring/engine';
import { SCHEMA_V1 } from '@/features/scoring/schema';
import type { VerificationEvent } from '@/features/scoring/types';

// Shapes the public verification-status response from a subject's event history,
// reusing the real scoring engine so external results always match the dashboard.

export interface CategorySummary {
  category: string;
  label: string;
  earnedPoints: number;
  cap: number;
}

export interface VerificationStatusResponse {
  /** Convenience boolean: true when the subject has any verified signal. */
  verified: boolean;
  /** 'verified' | 'unverified' — a stable string for badges/widgets. */
  status: 'verified' | 'unverified';
  /** Total Human Score across all categories. */
  humanScore: number;
  /** Per-category breakdown. Only included when the key has `read:score`. */
  categories?: CategorySummary[];
  /** Scoring algorithm version used to compute the result. */
  schemaVersion: string;
}

export interface BuildStatusOptions {
  /** Include the per-category Human Score breakdown (requires read:score). */
  includeScoreBreakdown: boolean;
  /** Override "now" for deterministic tests. */
  now?: number;
}

export function buildVerificationStatus(
  events: VerificationEvent[],
  options: BuildStatusOptions,
): VerificationStatusResponse {
  const explanation = computeScoreExplanation(events, SCHEMA_V1, options.now ?? Date.now());
  const verified = explanation.totalScore > 0;

  const response: VerificationStatusResponse = {
    verified,
    status: verified ? 'verified' : 'unverified',
    humanScore: explanation.totalScore,
    schemaVersion: explanation.algorithmVersion,
  };

  if (options.includeScoreBreakdown) {
    response.categories = explanation.categories.map((c) => ({
      category: c.category,
      label: c.label,
      earnedPoints: c.earnedPoints,
      cap: c.cap,
    }));
  }

  return response;
}
