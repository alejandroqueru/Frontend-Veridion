/**
 * Unifies the three parallel sources of provider metadata that exist today
 * (icons in `verifications/constants/*`, weights/labels in
 * `scoring/schema.ts`) into a single `providerId -> ProviderMeta` lookup for
 * the passport engine, WITHOUT modifying or re-exporting those existing
 * files — the current dashboard keeps importing them exactly as before.
 *
 * This is the one file a new verification provider's *presentation* needs
 * to touch (icon/visibility). Its scoring weight is a separate, pre-existing
 * concern owned by `scoring/schema.ts`. Neither file requires any renderer
 * (`templates/*`, `passport-renderer.tsx`, `snapshot.ts`, `encoding.ts`) to
 * change — see `registry.test.ts` for the parity guard that keeps this
 * honest, and `snapshot.test.ts` for proof an id present in neither source
 * still renders via the fallback path below.
 */

import type { ComponentType } from 'react';
import { ShieldQuestion } from 'lucide-react';
import { socialMediaVerifications } from '@/features/verifications/constants/social-verifications';
import { blockchainVerifications } from '@/features/verifications/constants/blockchain-verifications';
import { physicalVerifications } from '@/features/verifications/constants/physical-verifications';
import { getSchema, CURRENT_ALGORITHM_VERSION } from '@/features/scoring/schema';
import type { ProviderVisibilityRule } from './types';

export interface PassportIconProps {
  size?: number;
  className?: string;
}

export interface ProviderMeta {
  id: string;
  label: string;
  category: string;
  icon: ComponentType<PassportIconProps>;
  visibility: ProviderVisibilityRule;
}

export interface PassportProviderRegistry {
  get(providerId: string): ProviderMeta | undefined;
  /** Never throws — synthesizes a generic fallback ProviderMeta for ids this registry doesn't recognize, using whatever label/category the caller already has (e.g. from a decoded snapshot). */
  resolve(providerId: string, category: string, label: string): ProviderMeta;
  all(): ProviderMeta[];
}

const FALLBACK_ICON = ShieldQuestion as ComponentType<PassportIconProps>;

/**
 * Default visibility per category. `physical` defaults to `verified-only`
 * (privacy: don't broadcast incomplete KYC/biometric checks on a public
 * passport); `social`/`blockchain` default to `always` (fine to show a
 * locked placeholder — encourages completion, same as most badge products).
 */
const CATEGORY_DEFAULT_VISIBILITY: Record<string, ProviderVisibilityRule> = {
  social: 'always',
  blockchain: 'always',
  physical: 'verified-only',
};

function defaultVisibilityFor(category: string): ProviderVisibilityRule {
  return CATEGORY_DEFAULT_VISIBILITY[category] ?? 'always';
}

function metaFrom(
  id: string,
  category: string,
  label: string,
  icon: ComponentType<PassportIconProps>,
): ProviderMeta {
  return { id, category, label, icon, visibility: defaultVisibilityFor(category) };
}

function buildRegistryMap(): Record<string, ProviderMeta> {
  const entries: Record<string, ProviderMeta> = {};

  for (const item of socialMediaVerifications) {
    entries[item.id] = metaFrom(item.id, 'social', item.title, item.icon);
  }
  for (const item of blockchainVerifications) {
    entries[item.id] = metaFrom(item.id, 'blockchain', item.title, item.icon);
  }
  for (const item of physicalVerifications) {
    // lucide icon components carry a wider (all-optional) prop type than
    // PassportIconProps; structurally compatible at runtime, cast to align types.
    entries[item.id] = metaFrom(
      item.id,
      'physical',
      item.title,
      item.icon as unknown as ComponentType<PassportIconProps>,
    );
  }

  // Anything the scoring schema knows about but no constants file lists yet
  // (e.g. a provider added straight to schema.ts) still gets a registry
  // entry, using the fallback icon, so it's never a "no metadata at all" gap.
  const schema = getSchema(CURRENT_ALGORITHM_VERSION);
  for (const provider of Object.values(schema.providers)) {
    if (!entries[provider.id]) {
      entries[provider.id] = metaFrom(provider.id, provider.category, provider.label, FALLBACK_ICON);
    }
  }

  return entries;
}

let cachedRegistryMap: Record<string, ProviderMeta> | null = null;

function getRegistryMap(): Record<string, ProviderMeta> {
  if (!cachedRegistryMap) {
    cachedRegistryMap = buildRegistryMap();
  }
  return cachedRegistryMap;
}

export const passportProviderRegistry: PassportProviderRegistry = {
  get(providerId) {
    return getRegistryMap()[providerId];
  },
  resolve(providerId, category, label) {
    return getRegistryMap()[providerId] ?? metaFrom(providerId, category, label, FALLBACK_ICON);
  },
  all() {
    return Object.values(getRegistryMap());
  },
};
