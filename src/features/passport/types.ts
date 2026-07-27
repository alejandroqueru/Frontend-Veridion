/**
 * Core Passport data vocabulary. Deliberately framework-free (no React
 * imports) so `snapshot.ts` and `encoding.ts` stay pure and node-testable,
 * mirroring the same split `@/features/scoring/types.ts` uses for
 * `ScoreExplanation`. Icon components live in `registry.ts` instead, since
 * icons are a rendering concern, not a data-shape concern.
 */

export type PassportTemplateId = 'professional' | 'minimal' | 'dao' | 'social';

export type PassportRenderContext = 'editor' | 'public' | 'embed' | 'print' | 'export';

/**
 * Per-provider visibility policy. `verified-only` is the default for
 * sensitive categories (physical/KYC) so a public passport never advertises
 * "hasn't completed government-id" — it simply omits the badge until earned.
 * `always` shows a locked/incomplete placeholder, which is fine (even
 * encourages completion) for lower-stakes categories like social/blockchain.
 */
export type ProviderVisibilityRule = 'always' | 'verified-only';

export interface PassportProviderSnapshot {
  providerId: string;
  category: string;
  label: string;
  /** Rounded, capped points already applied — the same number the score dashboard shows. */
  points: number;
  occurredAt: number;
  /** Carried straight through from ProviderContribution — lets templates render a generic badge for providers the registry doesn't (yet) know about. */
  isUnknownProvider: boolean;
  /** Fields from a newer payload version this code doesn't understand yet — preserved on decode, ignored by current templates. */
  ext?: Record<string, unknown>;
}

export interface PassportCategorySnapshot {
  category: string;
  label: string;
  earnedPoints: number;
  cap: number;
  providers: PassportProviderSnapshot[];
}

/**
 * The one common schema every template/context renders from. Denormalized
 * (label/category/points copied inline per provider) rather than requiring a
 * registry lookup to reconstruct — this is what keeps an encoded share link
 * self-describing even after the app's provider registry changes shape.
 */
export interface PassportSnapshot {
  algorithmVersion: string;
  computedAt: number;
  totalScore: number;
  categories: PassportCategorySnapshot[];
}

export interface QrPresentationOptions {
  enabled: boolean;
  /** Rendered pixel size, both on screen and in print. */
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
}

export interface PassportPresentationOptions {
  template: PassportTemplateId;
  /** Seed hex color; `palette.ts` derives an accessible ramp from this. */
  accentColor: string;
  layout: 'compact' | 'detailed';
  qr: QrPresentationOptions;
  /**
   * Forward-compat feature flags. Purely additive: unrecognized flags are
   * ignored by current code rather than causing an error, which is what lets
   * a future version introduce new opt-in behavior without breaking old
   * encoded links decoded by current code, and vice versa.
   */
  features: string[];
}

export const DEFAULT_QR_OPTIONS: QrPresentationOptions = {
  enabled: true,
  size: 160,
  errorCorrectionLevel: 'M',
};

export const DEFAULT_PRESENTATION_OPTIONS: PassportPresentationOptions = {
  template: 'professional',
  accentColor: '#7EDA76',
  layout: 'detailed',
  qr: DEFAULT_QR_OPTIONS,
  features: [],
};
