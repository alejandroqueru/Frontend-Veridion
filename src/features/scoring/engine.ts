import type {
  CategoryConfig,
  CategoryContribution,
  DecayPolicy,
  ProviderConfig,
  ProviderContribution,
  ProviderId,
  ScoreExplanation,
  ScoringSchema,
  VerificationCategory,
  VerificationEvent,
} from './types';
import { hasLegacyPoints } from './types';

const DAY_MS = 86_400_000;

// ── Temporal decay ───────────────────────────────────────────────────

/**
 * Pure temporal decay. `ageMs` is always an explicit param (caller supplies
 * `now - event.occurredAt`) — this function never reads a clock, which is
 * what keeps the whole engine deterministic and reproducible.
 */
export function computeDecay(policy: DecayPolicy, ageMs: number): number {
  const ageDays = Math.max(0, ageMs) / DAY_MS;

  switch (policy.kind) {
    case 'none':
      return 1;

    case 'linear': {
      const floor = policy.floor ?? 0.2;
      if (policy.halfLifeDays <= 0) return floor;
      const raw = 1 - (ageDays / (policy.halfLifeDays * 2)) * (1 - floor);
      return Math.max(floor, Math.min(1, raw));
    }

    case 'step': {
      const floor = policy.floor ?? 0;
      const sorted = [...policy.steps].sort((a, b) => a.afterDays - b.afterDays);
      let weight = 1;
      for (const step of sorted) {
        if (ageDays >= step.afterDays) weight = step.weight;
      }
      return Math.max(floor, weight);
    }

    default:
      return 1;
  }
}

// ── Active-event selection (re-verification support) ─────────────────

/**
 * Picks the single "active" event per provider — the one that contributes to
 * the score. Older events for the same provider stay in the full history
 * (powering the timeline) but contribute 0. Latest `occurredAt` wins; ties
 * are broken by `eventId` for determinism.
 */
export function selectActiveEvents(events: VerificationEvent[]): Map<ProviderId, VerificationEvent> {
  const active = new Map<ProviderId, VerificationEvent>();

  for (const event of events) {
    const current = active.get(event.providerId);
    if (!current) {
      active.set(event.providerId, event);
      continue;
    }
    const isNewer =
      event.occurredAt > current.occurredAt ||
      (event.occurredAt === current.occurredAt && event.eventId > current.eventId);
    if (isNewer) {
      active.set(event.providerId, event);
    }
  }

  return active;
}

// ── Unknown-provider / defensive scoring ──────────────────────────────

export function createFallbackProvider(category: VerificationCategory = 'unknown'): ProviderConfig {
  return {
    id: '__unknown__',
    category,
    label: 'Unknown provider',
    baseWeight: 0,
    decay: { kind: 'none' },
  };
}

export interface SafeScoreResult {
  multiplier: number;
  error?: string;
}

/**
 * Runs a provider's `scoreFromSignals` defensively: a throwing or
 * non-finite implementation degrades to a 0 contribution plus a warning
 * instead of crashing the engine. A missing `scoreFromSignals` means the
 * provider is a simple boolean-completion type — full credit (1.0).
 */
export function safeScoreFromSignals(provider: ProviderConfig, rawPayload: unknown): SafeScoreResult {
  if (!provider.scoreFromSignals) {
    return { multiplier: 1 };
  }

  try {
    const result = provider.scoreFromSignals(rawPayload, { baseWeight: provider.baseWeight });
    if (!Number.isFinite(result)) {
      return {
        multiplier: 0,
        error: `Provider "${provider.id}" scoreFromSignals returned a non-finite value — scored at 0.`,
      };
    }
    return { multiplier: Math.max(0, Math.min(1, result)) };
  } catch (err) {
    return {
      multiplier: 0,
      error: `Provider "${provider.id}" scoreFromSignals threw: ${
        err instanceof Error ? err.message : String(err)
      } — scored at 0.`,
    };
  }
}

// ── Score computation entrypoint ───────────────────────────────────────

function resolveProvider(schema: ScoringSchema, providerId: string): { config: ProviderConfig; isUnknown: boolean } {
  const config = schema.providers[providerId];
  if (config) return { config, isUnknown: false };
  return { config: { ...schema.fallbackProvider, id: providerId }, isUnknown: true };
}

function resolveCategoryConfig(schema: ScoringSchema, category: string): CategoryConfig {
  return (
    schema.categories.find((c) => c.category === category) ?? {
      category,
      label: category,
      cap: Infinity,
    }
  );
}

function scaleToCapacity(
  providers: ProviderContribution[],
  cap: number,
): ProviderContribution[] {
  const total = providers.reduce((sum, p) => sum + p.contributedPoints, 0);
  const scale = total > cap && total > 0 ? cap / total : 1;
  return providers.map((p) => ({ ...p, cappedPoints: p.contributedPoints * scale }));
}

/**
 * The engine's single entry point. Pure and deterministic: same
 * (events, schema, now) always produces the same ScoreExplanation. `now` is
 * always supplied by the caller (never `Date.now()` internally), so decay
 * can be computed and tested at any point in time without a clock.
 */
export function computeScoreExplanation(
  events: VerificationEvent[],
  schema: ScoringSchema,
  now: number,
): ScoreExplanation {
  const warnings: string[] = [];
  const activeEvents = selectActiveEvents(events);

  const eventCounts = new Map<string, number>();
  for (const event of events) {
    eventCounts.set(event.providerId, (eventCounts.get(event.providerId) ?? 0) + 1);
  }

  const byCategory = new Map<string, ProviderContribution[]>();

  for (const [providerId, event] of activeEvents) {
    const { config: providerConfig, isUnknown } = resolveProvider(schema, providerId);
    if (isUnknown) {
      warnings.push(`Unknown provider "${providerId}" scored at fallback weight — schema may need an update.`);
    }

    let rawWeight: number;
    if (hasLegacyPoints(event.rawPayload)) {
      // Migrated legacy events carry their original point value directly —
      // this is what guarantees an exact score match immediately post-migration.
      rawWeight = event.rawPayload.legacyPoints;
    } else {
      const { multiplier, error } = safeScoreFromSignals(providerConfig, event.rawPayload);
      if (error) warnings.push(error);
      rawWeight = providerConfig.baseWeight * multiplier;
    }

    const decayFactor = computeDecay(providerConfig.decay, now - event.occurredAt);
    const contributedPoints = rawWeight * decayFactor;
    const category = event.category || providerConfig.category;

    const contribution: ProviderContribution = {
      providerId,
      category,
      label: providerConfig.label,
      activeEventId: event.eventId,
      occurredAt: event.occurredAt,
      rawWeight,
      decayFactor,
      contributedPoints,
      cappedPoints: contributedPoints,
      isUnknownProvider: isUnknown,
      eventCount: eventCounts.get(providerId) ?? 1,
    };

    const list = byCategory.get(category) ?? [];
    list.push(contribution);
    byCategory.set(category, list);
  }

  const seenCategories = new Set<string>();
  const categories: CategoryContribution[] = schema.categories.map((categoryConfig) => {
    seenCategories.add(categoryConfig.category);
    const providers = scaleToCapacity(byCategory.get(categoryConfig.category) ?? [], categoryConfig.cap);
    return {
      category: categoryConfig.category,
      label: categoryConfig.label,
      earnedPoints: providers.reduce((sum, p) => sum + p.cappedPoints, 0),
      cap: categoryConfig.cap,
      providers,
    };
  });

  // Defensive: an event may reference a category the schema never declared
  // (e.g. a future provider). Score it under a permissive default rather
  // than silently dropping it.
  for (const [category, providers] of byCategory) {
    if (seenCategories.has(category)) continue;
    const categoryConfig = resolveCategoryConfig(schema, category);
    const scaledProviders = scaleToCapacity(providers, categoryConfig.cap);
    categories.push({
      category,
      label: categoryConfig.label,
      earnedPoints: scaledProviders.reduce((sum, p) => sum + p.cappedPoints, 0),
      cap: categoryConfig.cap,
      providers: scaledProviders,
    });
    warnings.push(`Category "${category}" is not declared in schema "${schema.version}" — using a default cap.`);
  }

  const totalScore = categories.reduce((sum, c) => sum + c.earnedPoints, 0);

  return {
    algorithmVersion: schema.version,
    computedAt: now,
    totalScore,
    categories,
    history: events,
    warnings,
  };
}
