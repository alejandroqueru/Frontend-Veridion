'use client';

import { cn } from '@/lib/utils';
import { CategoryGroup } from './shared/category-group';
import { ScoreBadge } from './shared/score-badge';
import type { PassportTemplateProps } from './types';

/** Dark, glass, on-chain-first layout — blockchain category leads, monospace metadata. */
export function DaoTemplate({ snapshot, presentation, palette, context }: PassportTemplateProps) {
  const orderedCategories = [...snapshot.categories].sort((a, b) => {
    if (a.category === 'blockchain') return -1;
    if (b.category === 'blockchain') return 1;
    return 0;
  });

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 backdrop-blur-sm',
        context === 'print' ? 'bg-white text-black border-black/20' : 'bg-black/40 text-white',
      )}
      style={context !== 'print' ? { borderColor: palette.accent } : undefined}
    >
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest opacity-70 mb-4">
        <span>on-chain identity</span>
        <span>{snapshot.algorithmVersion}</span>
      </div>
      <div className="flex items-center justify-between mb-5">
        <ScoreBadge totalScore={snapshot.totalScore} accentColor={palette.accent} />
        <span
          className="font-mono text-[11px] rounded-full border px-3 py-1"
          style={{ borderColor: palette.accent, color: palette.accent }}
        >
          #{Math.max(1, Math.round(snapshot.totalScore))}
        </span>
      </div>
      <div className="grid gap-4">
        {orderedCategories.map((category) => (
          <CategoryGroup
            key={category.category}
            category={category}
            layout={presentation.layout}
            accentColor={palette.accent}
          />
        ))}
      </div>
    </div>
  );
}
