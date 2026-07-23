import type { ApiKeyClaims, ApiScope } from './types';
import { hasScope, verifyApiKey } from './api-keys';

// Turns an incoming request into an authenticated (or rejected) API caller.
// Kept framework-light: it takes a minimal `Headers`-like object so it can be
// unit-tested without constructing a full Next.js request.

export interface AuthSuccess {
  ok: true;
  claims: ApiKeyClaims;
}

export interface AuthFailure {
  ok: false;
  /** HTTP status the caller should return. */
  status: 401 | 403 | 500;
  error: string;
}

export type AuthResult = AuthSuccess | AuthFailure;

interface HeaderBag {
  get(name: string): string | null;
}

/** Extract the presented key from either `Authorization: Bearer` or `x-api-key`. */
export function extractApiKey(headers: HeaderBag): string | null {
  const authorization = headers.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match) return match[1].trim();
  }
  return headers.get('x-api-key');
}

/**
 * Authenticate a request and require a given scope.
 *
 * @param headers  request headers (anything with a `.get(name)`).
 * @param required the scope this endpoint needs.
 * @param secret   the signing secret; falls back to `VERIDION_API_KEY_SECRET`.
 */
export function authenticate(headers: HeaderBag, required: ApiScope, secret?: string): AuthResult {
  const signingSecret = secret ?? process.env.VERIDION_API_KEY_SECRET;
  if (!signingSecret) {
    // Misconfiguration, not the caller's fault — never leak details.
    return { ok: false, status: 500, error: 'API is not configured for key authentication' };
  }

  const presented = extractApiKey(headers);
  if (!presented) {
    return { ok: false, status: 401, error: 'Missing API key' };
  }

  const result = verifyApiKey(presented, signingSecret);
  if (!result.ok) {
    return { ok: false, status: 401, error: 'Invalid API key' };
  }

  if (!hasScope(result.claims, required)) {
    return { ok: false, status: 403, error: `API key is missing required scope "${required}"` };
  }

  return { ok: true, claims: result.claims };
}
