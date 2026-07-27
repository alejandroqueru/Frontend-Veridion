'use client';

import { cn } from '@/lib/utils';

export interface ScoreBadgeProps {
  totalScore: number;
  accentColor: string;
  size?: 'sm' | 'lg';
  className?: string;
}

export function ScoreBadge({ totalScore, accentColor, size = 'lg', className }: ScoreBadgeProps) {
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <span
        className={cn('font-bold tabular-nums leading-none', size === 'lg' ? 'text-5xl' : 'text-2xl')}
        style={{ color: accentColor }}
      >
        {Math.round(totalScore)}
      </span>
      <span className="text-xs uppercase tracking-wide opacity-60 mt-1">Human Score</span>
    </div>
  );
}
