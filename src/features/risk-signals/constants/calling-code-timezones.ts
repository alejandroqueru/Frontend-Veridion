// Coarse "which UTC offsets are plausible for this calling code" table,
// covering the same country set as
// `verifications/utils/phone-utils.ts#COUNTRY_CODES` (kept independent
// rather than imported, since that list only carries flag/label — this one
// carries a materially different kind of data with its own accuracy
// caveats, and coupling them would make an approximation read as more
// authoritative than it is).
//
// Ranges are in the same convention `Date#getTimezoneOffset()` uses:
// *minutes west of UTC* (so UTC-5 is +300, UTC+2 is -120) — the browser
// sends this convention as-is (see services/fingerprint.ts), so no sign
// flip is needed anywhere this table is read.
//
// Multi-timezone countries (US, Russia, Australia, Brazil...) get a wide
// [min, max] span covering their full range rather than one value — this
// is intentionally a coarse plausibility check, not a precise geolocation,
// and `engine/geo-mismatch-engine.ts` adds further tolerance on top.

export const PLAUSIBLE_UTC_OFFSET_MINUTES: Record<string, [number, number]> = {
  '1': [240, 600], // US/Canada: UTC-4 (Eastern DST) .. UTC-10 (Hawaii)
  '44': [-60, 0], // UK: UTC+0 .. UTC+1 (BST)
  '52': [300, 480], // Mexico: UTC-5 .. UTC-8
  '34': [-120, -60], // Spain: UTC+1 .. UTC+2
  '57': [300, 300], // Colombia: UTC-5, no DST
  '54': [180, 180], // Argentina: UTC-3, no DST
  '55': [120, 300], // Brazil: UTC-2 .. UTC-5
  '56': [180, 240], // Chile: UTC-3 .. UTC-4
  '51': [300, 300], // Peru: UTC-5, no DST
  '58': [240, 240], // Venezuela: UTC-4, no DST
  '49': [-120, -60], // Germany: UTC+1 .. UTC+2
  '33': [-120, -60], // France: UTC+1 .. UTC+2
  '39': [-120, -60], // Italy: UTC+1 .. UTC+2
  '31': [-120, -60], // Netherlands: UTC+1 .. UTC+2
  '41': [-120, -60], // Switzerland: UTC+1 .. UTC+2
  '81': [-540, -540], // Japan: UTC+9, no DST
  '86': [-480, -480], // China: UTC+8, single official timezone
  '91': [-330, -330], // India: UTC+5:30, no DST
  '7': [-720, -120], // Russia: UTC+2 .. UTC+12
  '82': [-540, -540], // South Korea: UTC+9, no DST
  '61': [-660, -480], // Australia: UTC+8 .. UTC+11 (DST)
  '64': [-780, -720], // New Zealand: UTC+12 .. UTC+13 (DST)
  '27': [-120, -120], // South Africa: UTC+2, no DST
  '234': [-60, -60], // Nigeria: UTC+1, no DST
  '20': [-120, -120], // Egypt: UTC+2, no DST
};

// Longest calling code first, so '234' (Nigeria) is matched before a
// hypothetical shorter prefix would be — calling codes are 1-3 digits and
// several share a leading digit (e.g. '1' vs no 1x/1xx codes here, but the
// table is written defensively for when it grows).
const CODES_BY_LENGTH_DESC = Object.keys(PLAUSIBLE_UTC_OFFSET_MINUTES).sort((a, b) => b.length - a.length);

/** Returns the plausible UTC-offset-minutes range for an E.164 number's calling code, or null if the code isn't in the table. */
export function plausibleOffsetRangeForPhone(e164: string): [number, number] | null {
  const digits = e164.startsWith('+') ? e164.slice(1) : e164;
  for (const code of CODES_BY_LENGTH_DESC) {
    if (digits.startsWith(code)) return PLAUSIBLE_UTC_OFFSET_MINUTES[code];
  }
  return null;
}
