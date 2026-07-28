'use client';

import { cn } from '@/lib/utils';
import { CategoryGroup } from './shared/category-group';
import type { PassportTemplateProps } from './types';

/** Rounded, colorful, shareable-card aesthetic — big circular score ring up front. */
export function SocialTemplate({ snapshot, presentation, palette, context }: PassportTemplateProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border p-6 text-center',
        context === 'print' ? 'bg-white text-black border-black/20' : 'bg-gradient-to-b from-card-dark to-black text-white',
      )}
      style={context !== 'print' ? { borderColor: palette.accent } : undefined}
    >
      <div
        className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full border-4"
        style={{ borderColor: palette.accent, color: context === 'print' ? palette.onLightSurface : palette.onDarkSurface }}
      >
        <span className="text-3xl font-bold tabular-nums">{Math.round(snapshot.totalScore)}</span>
      </div>
      <p className="text-sm opacity-70 mb-5">Verified Human</p>
      <div className="flex flex-col items-center gap-4">
        {snapshot.categories.map((category) => (
          <CategoryGroup
            key={category.category}
            category={category}
            layout={presentation.layout}
            accentColor={context === 'print' ? palette.onLightSurface : palette.onDarkSurface}
            className="w-full max-w-xs"
          />
        ))}
      </div>
    </div>
  );
}
