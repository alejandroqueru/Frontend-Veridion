'use client';

import { cn } from '@/lib/utils';
import type { ProviderMeta } from '../../registry';
import type { PassportProviderSnapshot } from '../../types';

export interface ProviderBadgeProps {
  meta: ProviderMeta;
  /** Present when this provider has been earned; absent renders a dimmed "not yet verified" placeholder. */
  earned?: PassportProviderSnapshot;
  layout: 'compact' | 'detailed';
  accentColor: string;
}

/**
 * The single place every template renders a provider — resolves its icon
 * generically via `meta.icon` (never `if (providerId === ...)`), so a brand
 * new provider entry in the registry/schema shows up here automatically.
 */
export function ProviderBadge({ meta, earned, layout, accentColor }: ProviderBadgeProps) {
  const Icon = meta.icon;
  const isEarned = Boolean(earned);
  const accessibleLabel = isEarned
    ? `${meta.label} — verified, ${Math.round(earned!.points)} points`
    : `${meta.label} — not yet verified`;

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        isEarned ? 'border-current' : 'opacity-40 grayscale border-current/40',
      )}
      style={{ color: isEarned ? accentColor : undefined, borderColor: isEarned ? accentColor : undefined }}
    >
      <Icon size={14} className="shrink-0" />
      {layout === 'detailed' && <span className="text-foreground/90">{meta.label}</span>}
      {layout === 'detailed' && isEarned && <span className="opacity-70">{Math.round(earned!.points)}</span>}
    </div>
  );
}
