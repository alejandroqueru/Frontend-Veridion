import { requireRole } from './roles';
import { verifyAccessToken } from './tokens';
import type { Role, SessionClaims } from './types';

// The stateless half of session enforcement: everything that can be decided
// from the presented token alone.
//
// This module deliberately imports no store, because Next.js middleware bundles
// for the edge runtime and must not pull in server-only state. The store-aware,
// authoritative guard lives in `guard.ts` — see the note on
// `authenticateStateless` for why the split exists.
//
// Kept framework-light (it takes anything with `.get(name)`) so it unit-tests
// without a Next.js request, matching `developer-api/auth.ts`.

export interface Session {
  address: string;
  roles: Role[];
  familyId: string;
  /** Epoch ms at which the presented access token stops being accepted. */
  expiresAt: number;
}

export interface SessionSuccess {
  ok: true;
  session: Session;
}

export interface SessionFailure {
  ok: false;
  status: 401 | 403 | 500;
  error: string;
}

export type SessionResult = SessionSuccess | SessionFailure;

interface HeaderBag {
  get(name: string): string | null;
}

/** The HMAC secret backing every session token. Absent means the deployment is
 * misconfigured, and every session check fails closed. */
export function sessionSecret(): string | null {
  return process.env.VERIDION_SESSION_SECRET ?? null;
}

/** A human-readable device label for the session list. Truncated because it is
 * attacker-controlled text that gets rendered back to the user. */
export function deviceFrom(headers: HeaderBag): string {
  const userAgent = headers.get('user-agent');
  if (!userAgent) return 'Unknown device';
  return userAgent.slice(0, 200);
}

function toSession(claims: SessionClaims): Session {
  return { address: claims.sub, roles: claims.roles, familyId: claims.fid, expiresAt: claims.exp };
}

/**
 * Extract the access token from `Authorization: Bearer`.
 *
 * Only that header — deliberately not `x-api-key`. Developer API keys are a
 * separate authentication axis; a key must never be accepted as a person's
 * session, nor a session as a key.
 */
export function extractAccessToken(headers: HeaderBag): string | null {
  const authorization = headers.get('authorization');
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match ? match[1].trim() : null;
}

/**
 * Verify the presented access token's signature, expiry and role, with no
 * store lookup.
 *
 * This is what Next.js middleware runs: middleware executes in its own runtime
 * and does not share module state with route handlers, so it cannot consult the
 * session store. It is a cryptographic pre-filter — the authoritative check,
 * including revocation, is `requireSession` inside the handler.
 */
export async function authenticateStateless(
  headers: HeaderBag,
  options: { role?: Role; secret?: string; now?: number } = {},
): Promise<SessionResult> {
  const secret = options.secret ?? process.env.VERIDION_SESSION_SECRET;
  if (!secret) {
    // Misconfiguration, not the caller's fault — fail closed, leak nothing.
    return { ok: false, status: 500, error: 'Server is not configured for session authentication.' };
  }

  const presented = extractAccessToken(headers);
  if (!presented) return { ok: false, status: 401, error: 'Missing session token.' };

  const result = await verifyAccessToken(presented, secret, options.now);
  if (!result.ok) {
    const error = result.reason === 'expired' ? 'Session token has expired.' : 'Invalid session token.';
    return { ok: false, status: 401, error };
  }

  const session = toSession(result.claims);
  if (options.role) {
    const allowed = requireRole(session.roles, options.role);
    if (!allowed.ok) return allowed;
  }

  return { ok: true, session };
}

/**
 * Require that the session is acting on its *own* subject.
 *
 * Holding a staff role does not grant authority over another address's
 * subject-scoped data, so this is an address match, not a role check.
 */
export function requireSelf(session: Session, subject: string): { ok: true } | SessionFailure {
  if (session.address === subject) return { ok: true };
  return { ok: false, status: 403, error: 'Session is not authorized for this subject.' };
}
