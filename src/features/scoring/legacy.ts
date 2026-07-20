import { socialMediaVerifications } from '@/features/verifications/constants/social-verifications';
import { physicalVerifications } from '@/features/verifications/constants/physical-verifications';
import { blockchainVerifications } from '@/features/verifications/constants/blockchain-verifications';
import type { CategoryContribution, ScoreExplanation, ScoringSchema, VerificationEvent } from './types';

// ── Legacy persisted shape ──────────────────────────────────────────────

/**
 * Frozen, standalone copy of the pre-migration persisted shape
 * (`verification-storage` localStorage key, prior to this scoring engine).
 * Deliberately has no live dependency on `verification-store.ts`, which is
 * rewritten as part of this change — this type is what the migration
 * function reads, independent of whatever the store looks like today.
 */
export interface LegacyVerificationStatus {
  id: string;
  type: 'social' | 'physical' | 'blockchain';
  completed: boolean;
  completedAt?: string | Date;
  points: number;
}

export interface LegacyPersistedState {
  completedVerifications: Record<string, LegacyVerificationStatus>;
  totalPoints: number;
}

export function isLegacyPersistedState(value: unknown): value is LegacyPersistedState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'completedVerifications' in value &&
    typeof (value as { completedVerifications: unknown }).completedVerifications === 'object'
  );
}

// ── Legacy → versioned event migration ──────────────────────────────────

function parseOccurredAt(value: string | Date | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function migrateOne(entry: LegacyVerificationStatus): VerificationEvent {
  const occurredAt = parseOccurredAt(entry.completedAt);
  return {
    eventId: `legacy:${entry.id}:${occurredAt}`,
    providerId: entry.id,
    category: entry.type,
    occurredAt,
    algorithmVersionAtCapture: 'v1',
    // The exact original point value, read directly by the engine
    // (bypassing baseWeight/scoreFromSignals entirely) — this is what
    // guarantees migrated users see an identical total post-migration.
    rawPayload: { legacyPoints: entry.points },
    source: 'migrated-legacy',
  };
}

/**
 * Pure: converts every completed legacy verification into one synthetic
 * VerificationEvent. Never throws on missing/malformed data — worst case,
 * an entry with a bad or missing `completedAt` gets `occurredAt: 0` rather
 * than being dropped or crashing the migration.
 */
export function migrateLegacyStateToEvents(
  legacy: LegacyPersistedState | null | undefined,
): VerificationEvent[] {
  if (!legacy?.completedVerifications) return [];

  return Object.values(legacy.completedVerifications)
    .filter((entry) => entry?.completed)
    .map(migrateOne);
}

// ── Legacy summary adapter (engine output → old dashboard shape) ────────

/**
 * Reproduces the dashboard's pre-engine `VerificationSummary` contract from
 * engine output, so `score-summary.tsx`, `category-breakdown.tsx`,
 * `next-best-action.tsx`, and `recent-activity.tsx` need only a data-source
 * swap, not a rewrite. New explainability components should consume
 * `ScoreExplanation` directly instead — this adapter exists purely to
 * minimize churn on the existing dashboard JSX.
 */
export type VerificationCategory = 'social' | 'physical' | 'blockchain';

export interface VerificationCatalogItem {
  id: string;
  title: string;
  description: string;
  category: VerificationCategory;
  availablePoints: number;
}

export interface CategorySummary {
  category: VerificationCategory;
  label: string;
  earnedPoints: number;
  availablePoints: number;
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
}

export interface NextBestActionItem {
  id: string;
  title: string;
  description: string;
  category: VerificationCategory;
  points: number;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  category: VerificationCategory;
  points: number;
  completedAt: Date;
}

export interface VerificationSummary {
  totalPoints: number;
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
  totalAvailablePoints: number;
  categories: CategorySummary[];
  nextBestActions: NextBestActionItem[];
  recentActivity: RecentActivityItem[];
  isEmpty: boolean;
  isFullyCompleted: boolean;
  isHydrated: boolean;
}

function getVerificationCatalog(schema: ScoringSchema): VerificationCatalogItem[] {
  const toCatalogItem =
    (category: VerificationCategory) =>
    (v: { id: string; title: string; description: string; points: number }): VerificationCatalogItem => ({
      id: v.id,
      title: v.title,
      description: v.description,
      category,
      availablePoints: schema.providers[v.id]?.baseWeight ?? v.points,
    });

  return [
    ...socialMediaVerifications.map(toCatalogItem('social')),
    ...physicalVerifications.map(toCatalogItem('physical')),
    ...blockchainVerifications.map(toCatalogItem('blockchain')),
  ];
}

function buildCategorySummaries(
  catalog: VerificationCatalogItem[],
  schema: ScoringSchema,
  contributions: CategoryContribution[],
): CategorySummary[] {
  return schema.categories.map((categoryConfig) => {
    const category = categoryConfig.category as VerificationCategory;
    const items = catalog.filter((item) => item.category === category);
    const contribution = contributions.find((c) => c.category === categoryConfig.category);
    const completedCount = contribution?.providers.length ?? 0;
    const availablePoints = items.reduce((sum, item) => sum + item.availablePoints, 0);

    return {
      category,
      label: categoryConfig.label,
      earnedPoints: contribution?.earnedPoints ?? 0,
      availablePoints,
      completedCount,
      totalCount: items.length,
      completionPercentage: items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
    };
  });
}

export function toLegacySummary(
  explanation: ScoreExplanation,
  schema: ScoringSchema,
  isHydrated: boolean,
): VerificationSummary {
  const catalog = getVerificationCatalog(schema);
  const totalCount = catalog.length;
  const totalAvailablePoints = catalog.reduce((sum, item) => sum + item.availablePoints, 0);

  if (!isHydrated) {
    return {
      totalPoints: 0,
      completedCount: 0,
      totalCount,
      completionPercentage: 0,
      totalAvailablePoints,
      categories: buildCategorySummaries(catalog, schema, []),
      nextBestActions: [],
      recentActivity: [],
      isEmpty: true,
      isFullyCompleted: false,
      isHydrated: false,
    };
  }

  const activeContributions = explanation.categories.flatMap((c) => c.providers);
  const completedProviderIds = new Set(activeContributions.map((p) => p.providerId));
  const completedCount = completedProviderIds.size;

  const nextBestActions: NextBestActionItem[] = catalog
    .filter((item) => !completedProviderIds.has(item.id))
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      points: item.availablePoints,
    }))
    .sort((a, b) => b.points - a.points);

  const recentActivity: RecentActivityItem[] = activeContributions
    .map((contribution) => {
      const catalogItem = catalog.find((item) => item.id === contribution.providerId);
      if (!catalogItem) return null;
      return {
        id: contribution.providerId,
        title: catalogItem.title,
        category: contribution.category as VerificationCategory,
        points: Math.round(contribution.cappedPoints),
        completedAt: new Date(contribution.occurredAt),
      };
    })
    .filter((item): item is RecentActivityItem => item !== null)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

  return {
    totalPoints: explanation.totalScore,
    completedCount,
    totalCount,
    completionPercentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    totalAvailablePoints,
    categories: buildCategorySummaries(catalog, schema, explanation.categories),
    nextBestActions,
    recentActivity,
    isEmpty: explanation.totalScore === 0,
    isFullyCompleted: completedCount === totalCount && totalCount > 0,
    isHydrated: true,
  };
}
