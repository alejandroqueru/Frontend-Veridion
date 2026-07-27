import type { ComponentType } from 'react';
import type { PassportPresentationOptions, PassportRenderContext, PassportSnapshot } from '../types';
import type { AccessiblePalette } from '../palette';

/**
 * The one prop shape every template receives. Templates are presentational
 * only — they read `snapshot`/`presentation`/`palette` generically (via
 * `CategoryGroup`/`ProviderBadge`) and never branch on a specific
 * `providerId`, which is what lets a new verification provider appear in
 * every template without any of these files changing.
 */
export interface PassportTemplateProps {
  snapshot: PassportSnapshot;
  presentation: PassportPresentationOptions;
  context: PassportRenderContext;
  palette: AccessiblePalette;
}

export type PassportTemplateComponent = ComponentType<PassportTemplateProps>;
