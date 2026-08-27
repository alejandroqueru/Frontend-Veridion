import { authenticateStateless } from './request-session';
import type { SessionResult } from './request-session';
import { requireRole, resolveRoles } from './roles';
import { getSessionStore } from './session-store';
import type { Role } from './types';

// The authoritative session guard for route handlers.
//
// Every subject- or staff-scoped route calls this one function — none of them
// re-implement a check of their own. It is separate from `request-session.ts`
// only because it touches the session store, which middleware (edge runtime,
// and a separate module instance from the handlers) must not import.

/**
 * Everything `authenticateStateless` does, plus two things only the server can
 * know: that the session family still exists, and what roles its address holds
 * *right now*.
 *
 * The family check is what makes "revoke this device" and "sign out everywhere"
 * take effect immediately, rather than whenever the short-lived access token
 * happens to expire. The role re-resolution is why a required role is checked
 * here and not by `authenticateStateless`: the roles baked into a token were
 * true when it was minted, and an operator removed from the allowlist must lose
 * access at the next request, not at the next token expiry.
 */
export async function requireSession(
  headers: { get(name: string): string | null },
  options: { role?: Role; secret?: string; now?: number } = {},
): Promise<SessionResult> {
  // Deliberately without `role` — see above; the role gate runs below, against
  // freshly resolved roles rather than the token's copy.
  const result = await authenticateStateless(headers, { secret: options.secret, now: options.now });
  if (!result.ok) return result;

  const family = await getSessionStore().get(result.session.familyId);
  if (!family) {
    return { ok: false, status: 401, error: 'Session has been revoked.' };
  }

  // Defence in depth. We only ever mint a token whose subject matches its
  // family's address, so a mismatch means something is wrong that this code
  // cannot reason about — refuse rather than guess which of the two to trust.
  if (family.address !== result.session.address) {
    return { ok: false, status: 401, error: 'Session is not valid.' };
  }

  const roles = resolveRoles(family.address);
  if (options.role) {
    const allowed = requireRole(roles, options.role);
    if (!allowed.ok) return allowed;
  }

  return { ok: true, session: { ...result.session, roles } };
}
