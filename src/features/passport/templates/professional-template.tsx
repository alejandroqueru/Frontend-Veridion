'use client';

import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Symbol } from '@/shared/components/icons/symbol';
import { cn } from '@/lib/utils';
import { CategoryGroup } from './shared/category-group';
import { ScoreBadge } from './shared/score-badge';
import type { PassportTemplateProps } from './types';

/** Formal, letterhead-style layout — the default template. */
export function ProfessionalTemplate({ snapshot, presentation, palette, context }: PassportTemplateProps) {
  const isCompact = presentation.layout === 'compact';

  return (
    <Card
      className={cn(
        'bg-card-dark border-custom-border text-white',
        context === 'print' && 'shadow-none border-black/20 bg-white text-black print:break-inside-avoid',
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between border-b border-custom-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Symbol size="md" className={context === 'print' ? 'text-black' : 'text-white'} />
          <div>
            <p className="text-sm font-semibold leading-tight">Digital Identity Passport</p>
            <p className="text-xs opacity-60 leading-tight">Algorithm {snapshot.algorithmVersion}</p>
          </div>
        </div>
        <ScoreBadge totalScore={snapshot.totalScore} accentColor={palette.onDarkSurface} size={isCompact ? 'sm' : 'lg'} />
      </CardHeader>
      <CardContent className={cn('flex flex-col gap-4 pt-4', isCompact && 'gap-3')}>
        {snapshot.categories.map((category) => (
          <CategoryGroup
            key={category.category}
            category={category}
            layout={presentation.layout}
            accentColor={context === 'print' ? palette.onLightSurface : palette.onDarkSurface}
          />
        ))}
        <p className="text-[11px] opacity-50 pt-2 border-t border-current/10">
          Generated {new Date(snapshot.computedAt).toLocaleDateString()} · verify.veridion
        </p>
      </CardContent>
    </Card>
  );
}
