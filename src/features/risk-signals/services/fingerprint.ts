"use client";

// Lightweight, privacy-conscious device signal captured client-side at
// verification time. Deliberately NOT a canvas/audio/WebGL fingerprinting
// library: it hashes a handful of properties the browser already exposes to
// any page (UA, language, screen geometry, timezone, hardware concurrency),
// so no new tracking surface is added and the raw values never leave the
// browser — only the hash is ever sent to the server (see
// `hooks/use-risk-signal-reporter.ts`).
//
// This is intentionally coarse: it is not meant to uniquely identify one
// person (a real fingerprinting library would try to), only to give the
// correlation signal in `engine/correlation-engine.ts` something that tends
// to collide across sessions launched from the same automated
// browser/host, and tends to differ across genuinely different people.

const FINGERPRINT_CACHE_KEY = 'veridion-device-signal';

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  // Same ArrayBufferLike/ArrayBuffer mismatch worked around in
  // otp-service.ts#hashIdentifier — TextEncoder#encode's return type isn't
  // directly assignable to subtle.digest's BufferSource param.
  const buffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function collectFingerprintInputs(): string {
  const nav = window.navigator as Navigator & { deviceMemory?: number };
  const parts = [
    nav.userAgent,
    nav.language,
    Array.isArray(nav.languages) ? nav.languages.join(',') : '',
    String(nav.hardwareConcurrency ?? ''),
    String(nav.deviceMemory ?? ''),
    nav.platform ?? '',
    `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    String(Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''),
    String(new Date().getTimezoneOffset()),
  ];
  return parts.join('|');
}

/**
 * Returns a stable hash for this browser tab/session, computing it once and
 * caching it in `sessionStorage` so repeated verification steps in one
 * session report the same signal without recomputing it. Falls back to a
 * fresh computation (no caching) if `sessionStorage` is unavailable (private
 * browsing, disabled storage, etc.) — never throws.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return '';

  try {
    const cached = window.sessionStorage.getItem(FINGERPRINT_CACHE_KEY);
    if (cached) return cached;
  } catch {
    // sessionStorage inaccessible — fall through and compute without caching.
  }

  const fingerprint = await sha256Hex(collectFingerprintInputs());

  try {
    window.sessionStorage.setItem(FINGERPRINT_CACHE_KEY, fingerprint);
  } catch {
    // Best-effort cache only.
  }

  return fingerprint;
}
