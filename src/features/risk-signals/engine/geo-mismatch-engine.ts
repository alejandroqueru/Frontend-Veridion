import { plausibleOffsetRangeForPhone } from '../constants/calling-code-timezones';
import type { RiskSignal } from '../types';

export interface GeoMismatchConfig {
  /** Extra minutes of slack added to each side of a country's plausible offset range, to absorb DST edge cases and the table's inherent coarseness. */
  toleranceMinutes: number;
}

export const DEFAULT_GEO_MISMATCH_CONFIG: GeoMismatchConfig = { toleranceMinutes: 90 };

/**
 * Pure function: coarse plausibility check between a verified phone
 * number's calling code and the browser's timezone offset (see
 * `services/fingerprint.ts#getTimezoneOffsetMinutes` and
 * `constants/calling-code-timezones.ts`). A mismatch — a phone claiming to
 * be Peruvian while the browser reports a Southeast-Asian timezone — is a
 * plausibility check, not proof; it deliberately can't rule anything IN, it
 * can only flag a claim that doesn't add up, and only weakly (see
 * `risk-engine.ts`'s SIGNAL_WEIGHTS — this carries the lowest weight of all
 * five signals). Missing data of either kind is treated as "not evaluated"
 * (score 0), never as suspicious on its own.
 */
export function computeGeoMismatchSignal(
  phone: string | undefined,
  timezoneOffsetMinutes: number | undefined,
  config: GeoMismatchConfig = DEFAULT_GEO_MISMATCH_CONFIG,
): RiskSignal {
  if (!phone || timezoneOffsetMinutes === undefined) {
    return {
      type: 'geo-mismatch',
      score: 0,
      detail: 'Not evaluated — missing phone number or browser timezone.',
    };
  }

  const range = plausibleOffsetRangeForPhone(phone);
  if (!range) {
    return {
      type: 'geo-mismatch',
      score: 0,
      detail: 'Not evaluated — calling code not in the known-country table.',
    };
  }

  const [min, max] = range;
  const plausible =
    timezoneOffsetMinutes >= min - config.toleranceMinutes && timezoneOffsetMinutes <= max + config.toleranceMinutes;

  return {
    type: 'geo-mismatch',
    score: plausible ? 0 : 1,
    detail: plausible
      ? "Browser timezone is plausible for the phone's calling code."
      : `Browser timezone offset (${timezoneOffsetMinutes}) is implausible for the phone's calling code (expected ${min}..${max}, ±${config.toleranceMinutes}min tolerance).`,
  };
}
