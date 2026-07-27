'use client';

import { cn } from '@/lib/utils';
import { passportProviderRegistry } from '../registry';
import { ProviderBadge } from './shared/provider-badge';
import type { PassportTemplateProps } from './types';

/** Ultra-sparse single-row layout: score + a flat row of earned badges, no category headers. */
export function MinimalTemplate({ snapshot, presentation, palette, context }: PassportTemplateProps) {
  const earnedProviders = snapshot.categories.flatMap((category) => category.providers);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3',
        context === 'print' ? 'bg-white text-black border-black/20' : 'bg-card-darker border-custom-border text-white',
      )}
    >
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: context === 'print' ? palette.onLightSurface : palette.onDarkSurface }}
      >
        {Math.round(snapshot.totalScore)}
      </span>
      <div role="list" aria-label="Verified providers" className="flex flex-wrap gap-1.5">
        {earnedProviders.map((provider) => (
          <ProviderBadge
            key={provider.providerId}
            meta={passportProviderRegistry.resolve(provider.providerId, provider.category, provider.label)}
            earned={provider}
            layout={presentation.layout}
            accentColor={context === 'print' ? palette.onLightSurface : palette.onDarkSurface}
          />
        ))}
      </div>
    </div>
  );
}
