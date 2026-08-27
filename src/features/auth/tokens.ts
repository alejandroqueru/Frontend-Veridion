import type { Role, SessionClaims, VerifyTokenResult } from './types';
import { ALL_ROLES } from './types';

// Session tokens.
//
// An access token is the same shape as a Veridion API key — a tiny signed
// token whose claims travel inside it:
//
//     vsa_<base64url(claims)>.<base64url(HMAC-SHA256(payload, secret))>
//
// so verifying one is a signature check with no store lookup. The prefix is
// distinct from `vrd_` because these are two different authentication axes:
// `vrd_` keys authenticate third-party *apps*, `vsa_` tokens authenticate
// *people*. A token from one axis must never validate on the other.
//
// Unlike `developer-api/api-keys.ts` (which uses node:crypto synchronously),
// this module uses the Web Crypto API. That is what makes it usable unchanged
// from Next.js middleware, which is the whole point of having one central
// enforcement path: middleware and route handlers run the same verification
// code rather than two implementations that can drift apart.
//
// Access tokens are short-lived and stateless, so revoking a session cannot
// instantly kill an already-issued one; it stops the *refresh*, and the access
// token dies within its TTL. That trade is why the TTL is minutes, not hours.

const ACCESS_PREFIX = 'vsa_';
const REFRESH_PREFIX = 'vsr_';

/** How long an access token is accepted for. */
export const ACCESS_TOKEN_TTL_MS = 10 * 60 * 1000;

/** How long a session family survives without a refresh. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** UTF-8 bytes, copied into a plain `ArrayBuffer`-backed view.
 * `TextEncoder.encode` is typed over `ArrayBufferLike`, which Web Crypto's
 * `BufferSource` will not accept, so the copy is what keeps the types honest. */
function utf8(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(encoder.encode(value));
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, utf8(payload));
  return bytesToBase64url(new Uint8Array(signature));
}

/** Constant-time comparison, to avoid leaking a signature through response
 * timing on a char-by-char short-circuit compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** SHA-256, base64url — used to store refresh tokens by hash, never in the raw. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8(token));
  return bytesToBase64url(new Uint8Array(digest));
}

/** Cryptographically random base64url string of `byteLength` bytes of entropy.
 * Uses the Web Crypto global rather than `node:crypto` so every module in this
 * feature stays importable from the edge runtime. */
export function randomBase64url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64url(bytes);
}

export interface IssueAccessTokenInput {
  address: string;
  roles: Role[];
  familyId: string;
  /** Override the clock — tests only. */
  now?: number;
}

/** Mint a signed, short-lived access token. */
export async function issueAccessToken(input: IssueAccessTokenInput, secret: string): Promise<string> {
  if (!secret) throw new Error('Missing session signing secret');
  const now = input.now ?? Date.now();
  const claims: SessionClaims = {
    v: 1,
    sub: input.address,
    roles: input.roles,
    fid: input.familyId,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_MS,
  };
  const payload = bytesToBase64url(utf8(JSON.stringify(claims)));
  return `${ACCESS_PREFIX}${payload}.${await hmac(payload, secret)}`;
}

function isValidClaims(value: unknown): value is SessionClaims {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    c.v === 1 &&
    typeof c.sub === 'string' &&
    c.sub.length > 0 &&
    typeof c.fid === 'string' &&
    c.fid.length > 0 &&
    typeof c.iat === 'number' &&
    typeof c.exp === 'number' &&
    Array.isArray(c.roles) &&
    c.roles.length > 0 &&
    c.roles.every((r) => (ALL_ROLES as readonly string[]).includes(r as string))
  );
}

/** Verify an access token's signature and expiry. Never throws on bad input. */
export async function verifyAccessToken(
  token: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): Promise<VerifyTokenResult> {
  if (!secret) throw new Error('Missing session signing secret');
  if (typeof token !== 'string' || !token.startsWith(ACCESS_PREFIX)) {
    return { ok: false, reason: 'malformed' };
  }

  const body = token.slice(ACCESS_PREFIX.length);
  const dot = body.indexOf('.');
  if (dot <= 0 || dot === body.length - 1) return { ok: false, reason: 'malformed' };

  const payload = body.slice(0, dot);
  const signature = body.slice(dot + 1);

  if (!safeEqual(signature, await hmac(payload, secret))) {
    return { ok: false, reason: 'bad-signature' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(base64urlToBytes(payload)));
  } catch {
    return { ok: false, reason: 'invalid-claims' };
  }

  if (!isValidClaims(parsed)) return { ok: false, reason: 'invalid-claims' };
  // Expiry is checked only after the signature, so an attacker cannot learn
  // anything from a forged token beyond "rejected".
  if (parsed.exp <= now) return { ok: false, reason: 'expired' };

  return { ok: true, claims: parsed };
}

/**
 * Mint an opaque refresh token.
 *
 * The family id is carried in the clear so a presented token can be looked up
 * in one step. That is what makes reuse *detectable*: a rotated-out token still
 * names its family, so the server can tell "this belonged to family X but is no
 * longer current" (compromise) apart from "this is unparseable garbage". The
 * secret half is 32 random bytes, so knowing a family id grants nothing.
 */
export function issueRefreshToken(familyId: string): string {
  return `${REFRESH_PREFIX}${familyId}.${randomBase64url(32)}`;
}

/** Pull the family id out of a refresh token, without trusting the rest of it. */
export function parseRefreshToken(token: string | null | undefined): { familyId: string } | null {
  if (typeof token !== 'string' || !token.startsWith(REFRESH_PREFIX)) return null;
  const body = token.slice(REFRESH_PREFIX.length);
  const dot = body.indexOf('.');
  if (dot <= 0 || dot === body.length - 1) return null;
  return { familyId: body.slice(0, dot) };
}
