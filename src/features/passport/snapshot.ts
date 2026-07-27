import type { CategoryContribution, ProviderContribution, ScoreExplanation } from '@/features/scoring/types';
import type { PassportCategorySnapshot, PassportProviderSnapshot, PassportSnapshot } from './types';

function buildProviderSnapshot(provider: ProviderContribution): PassportProviderSnapshot {
  return {
    providerId: provider.providerId,
    category: provider.category,
    label: provider.label,
    points: provider.cappedPoints,
    occurredAt: provider.occurredAt,
    isUnknownProvider: provider.isUnknownProvider,
  };
}

function buildCategorySnapshot(category: CategoryContribution): PassportCategorySnapshot {
  return {
    category: category.category,
    label: category.label,
    earnedPoints: category.earnedPoints,
    cap: category.cap,
    providers: category.providers.map(buildProviderSnapshot),
  };
}

/**
 * Pure adapter, `ScoreExplanation -> PassportSnapshot`, following the same
 * pattern as `scoring/legacy.ts`'s `toLegacySummary`: a different-shaped view
 * over engine output, without touching the engine itself. Deliberately does
 * not consult the provider registry — label/category/points are carried
 * straight through from `ProviderContribution` (a shape the scoring engine
 * already produces for any provider, known or not), which is what lets a
 * brand-new provider flow through untouched before anyone teaches the
 * passport registry its icon (see registry.ts's fallback path).
 */
export function buildPassportSnapshot(explanation: ScoreExplanation): PassportSnapshot {
  return {
    algorithmVersion: explanation.algorithmVersion,
    computedAt: explanation.computedAt,
    totalScore: explanation.totalScore,
    categories: explanation.categories.map(buildCategorySnapshot),
  };
}
