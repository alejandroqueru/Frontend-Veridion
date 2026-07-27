'use client';

import { cn } from '@/lib/utils';
import { passportProviderRegistry, type ProviderMeta } from '../../registry';
import type { PassportCategorySnapshot, PassportProviderSnapshot } from '../../types';
import { ProviderBadge } from './provider-badge';

export interface CategoryGroupProps {
  category: PassportCategorySnapshot;
  layout: 'compact' | 'detailed';
  accentColor: string;
  className?: string;
}

interface BadgeEntry {
  meta: ProviderMeta;
  earned?: PassportProviderSnapshot;
}

/**
 * Cross-references this category's *earned* providers against the full
 * provider registry to decide what to render: an earned badge for anything
 * present in `category.providers`, plus a dimmed "locked" placeholder for
 * every other registry provider in this category whose visibility rule is
 * `always` (omitted entirely for `verified-only`, e.g. physical/KYC — see
 * registry.ts). Any earned provider the registry doesn't recognize still
 * renders via `passportProviderRegistry.resolve`'s fallback — this is the
 * concrete mechanism proving new providers need no renderer changes.
 */
export function CategoryGroup({ category, layout, accentColor, className }: CategoryGroupProps) {
  const earnedById = new Map(category.providers.map((provider) => [provider.providerId, provider]));
  const seen = new Set<string>();
  const entries: BadgeEntry[] = [];

  for (const meta of passportProviderRegistry.all()) {
    if (meta.category !== category.category) continue;
    seen.add(meta.id);
    entries.push({ meta, earned: earnedById.get(meta.id) });
  }

  for (const provider of category.providers) {
    if (seen.has(provider.providerId)) continue;
    entries.push({
      meta: passportProviderRegistry.resolve(provider.providerId, provider.category, provider.label),
      earned: provider,
    });
  }

  const visible = entries.filter((entry) => entry.earned || entry.meta.visibility === 'always');
  if (visible.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground/90">{category.label}</span>
        <span className="text-xs opacity-60 tabular-nums">
          {Math.round(category.earnedPoints)} / {Math.round(category.cap)}
        </span>
      </div>
      <div role="list" aria-label={`${category.label} verifications`} className={cn('flex flex-wrap gap-2')}>
        {visible.map(({ meta, earned }) => (
          <ProviderBadge key={meta.id} meta={meta} earned={earned} layout={layout} accentColor={accentColor} />
        ))}
      </div>
    </div>
  );
}
