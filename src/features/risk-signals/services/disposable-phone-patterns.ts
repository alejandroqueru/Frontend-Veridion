// Extends the `disposable-domains.ts` idea (a curated, extendable pattern
// list) to phone/SMS verification. Unlike email domains, there's no static
// list of "disposable phone numbers" to enumerate — real systems use a
// carrier-lookup API (e.g. Twilio Lookup), which isn't wired into this repo
// (no vendor credentials). Instead this uses heuristics real fraud checks
// commonly rely on even without a carrier lookup:
//
//  1. NANP (+1) toll-free prefixes — a genuine individual essentially never
//     verifies a personal OTP from a toll-free line; these are overwhelmingly
//     virtual/business numbers, exactly the kind of "real-looking" number a
//     bot farm can provision in bulk.
//  2. The NANP fictional-reserved range (NXX-555-01XX) — reserved by NANPA
//     for film/TV, never a real subscriber. A dead giveaway of fabricated
//     input.
//  3. Repeated or sequential digit patterns (e.g. 5555555555, 1234567890) —
//     common in scripted/test data, rare in real numbers.
//
// `TOLL_FREE_AREA_CODES` is a plain extendable Set, same shape as
// `DISPOSABLE_DOMAINS` in `disposable-domains.ts`.

const TOLL_FREE_AREA_CODES = new Set(['800', '833', '844', '855', '866', '877', '888']);

function isFictionalReservedNumber(nationalNumber: string): boolean {
  return /^\d{3}55501\d{2}$/.test(nationalNumber);
}

function hasRepeatingOrSequentialPattern(nationalNumber: string): boolean {
  if (/^(\d)\1+$/.test(nationalNumber)) return true; // e.g. 5555555555

  const ascending = '01234567890123456789';
  const descending = '98765432109876543210';
  return ascending.includes(nationalNumber) || descending.includes(nationalNumber);
}

/**
 * @param e164 A phone number in E.164 format (e.g. `+18005551234`), as
 * produced by `utils/phone-utils.ts#normalizePhone`.
 */
export function isDisposablePhoneNumber(e164: string): boolean {
  if (!/^\+\d{7,15}$/.test(e164)) return false;

  const isNanp = e164.startsWith('+1') && e164.length === 12;
  // For NANP numbers, strip the '+1' country code before pattern-matching so
  // a sequential/repeating *national* number (e.g. 1234567890) isn't missed
  // just because the leading country-code digit breaks the run. For
  // everything else we don't reliably know the country-code length, so we
  // pattern-match on everything after the '+'.
  const significantDigits = isNanp ? e164.slice(2) : e164.slice(1);

  if (isNanp) {
    const areaCode = significantDigits.slice(0, 3);
    if (TOLL_FREE_AREA_CODES.has(areaCode)) return true;
    if (isFictionalReservedNumber(significantDigits)) return true;
  }

  return hasRepeatingOrSequentialPattern(significantDigits);
}
