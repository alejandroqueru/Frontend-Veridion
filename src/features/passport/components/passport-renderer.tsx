'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { generateAccessiblePalette } from '../palette';
import { getPassportTemplate } from '../templates/template-registry';
import type { PassportPresentationOptions, PassportRenderContext, PassportSnapshot } from '../types';

export interface PassportRendererProps {
  snapshot: PassportSnapshot;
  presentation: PassportPresentationOptions;
  context: PassportRenderContext;
  className?: string;
}

const CONTEXT_CLASSNAMES: Record<PassportRenderContext, string> = {
  editor: '',
  public: 'max-w-xl mx-auto',
  embed: 'max-w-full',
  print: 'print:shadow-none',
  export: 'max-w-2xl mx-auto',
};

/**
 * The single funnel every render context goes through — interactive editor,
 * public share page, embedded iframe, print layout, and export view all
 * call exactly this component with the same `snapshot`/`presentation`. Only
 * the surrounding page chrome differs between contexts (see the 5
 * `src/app` routes); the template is the only thing that changes what
 * actually renders.
 */
export function PassportRenderer({ snapshot, presentation, context, className }: PassportRendererProps) {
  const Template = getPassportTemplate(presentation.template);
  const palette = useMemo(() => generateAccessiblePalette(presentation.accentColor), [presentation.accentColor]);

  return (
    <div data-passport-context={context} className={cn(CONTEXT_CLASSNAMES[context], className)}>
      <Template snapshot={snapshot} presentation={presentation} context={context} palette={palette} />
    </div>
  );
}
