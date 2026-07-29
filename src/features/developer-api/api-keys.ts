import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type { ApiKeyClaims, ApiScope, VerifyKeyResult } from './types';
import { ALL_SCOPES } from './types';

// A Veridion API key is a compact, signed token — conceptually a tiny JWT:
//
//     vrd_<base64url(claims)>.<base64url(HMAC-SHA256(payload, secret))>
//
// The claims (appId, scopes, ...) travel *inside* the key, so verifying a key
// is a signature check — no database lookup required. Only the server knows the
// signing secret, so a client cannot forge or tamper with a key.

const KEY_PREFIX = 'vrd_';

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Constant-time string comparison to avoid signature timing leaks. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface IssueKeyInput {
  appName: string;
  scopes: ApiScope[];
  /** Optional stable app id; a random one is generated when omitted. */
  appId?: string;
}

/** Mint a new signed API key. The returned string is the full secret and is
 * shown to the developer exactly once — only its signature can be re-derived. */
export function issueApiKey(input: IssueKeyInput, secret: string): { key: string; claims: ApiKeyClaims } {
  if (!secret) throw new Error('Missing API key signing secret');
  const claims: ApiKeyClaims = {
    v: 1,
    appId: input.appId ?? randomUUID(),
    appName: input.appName,
    scopes: input.scopes,
    iat: Date.now(),
  };
  const payload = base64url(JSON.stringify(claims));
  const key = `${KEY_PREFIX}${payload}.${sign(payload, secret)}`;
  return { key, claims };
}

function isValidClaims(value: unknown): value is ApiKeyClaims {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    c.v === 1 &&
    typeof c.appId === 'string' &&
    c.appId.length > 0 &&
    typeof c.appName === 'string' &&
    typeof c.iat === 'number' &&
    Array.isArray(c.scopes) &&
    c.scopes.every((s) => (ALL_SCOPES as string[]).includes(s as string))
  );
}

/** Verify a key's signature and decode its claims. Never throws on bad input. */
export function verifyApiKey(key: string | null | undefined, secret: string): VerifyKeyResult {
  if (!secret) throw new Error('Missing API key signing secret');
  if (typeof key !== 'string' || !key.startsWith(KEY_PREFIX)) {
    return { ok: false, reason: 'malformed' };
  }

  const body = key.slice(KEY_PREFIX.length);
  const dot = body.indexOf('.');
  if (dot <= 0 || dot === body.length - 1) return { ok: false, reason: 'malformed' };

  const payload = body.slice(0, dot);
  const signature = body.slice(dot + 1);

  if (!safeEqual(signature, sign(payload, secret))) {
    return { ok: false, reason: 'bad-signature' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid-claims' };
  }

  if (!isValidClaims(parsed)) return { ok: false, reason: 'invalid-claims' };
  return { ok: true, claims: parsed };
}

/** Whether a set of claims grants a required scope. */
export function hasScope(claims: ApiKeyClaims, scope: ApiScope): boolean {
  return claims.scopes.includes(scope);
}
