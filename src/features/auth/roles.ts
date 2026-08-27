import type { Role } from './types';
import { ALL_ROLES } from './types';

// Role registry and the server-held staff allowlist.
//
// Staff roles are assigned by address through env vars — never self-asserted by
// a client, and deliberately with no admin UI for managing them (out of scope).
// Every authenticated address implicitly holds `subject`, which authorizes
// acting on that address's *own* data and nothing else.

/** Which roles each role implies. A senior reviewer can do a reviewer's job;
 * an admin can do both. `subject` is orthogonal — holding a staff role never
 * grants authority over some *other* address's subject-scoped data. */
const IMPLIES: Record<Role, readonly Role[]> = {
  subject: ['subject'],
  reviewer: ['reviewer'],
  'senior-reviewer': ['senior-reviewer', 'reviewer'],
  admin: ['admin', 'senior-reviewer', 'reviewer'],
};

const STAFF_ROLE_ENV: Record<Exclude<Role, 'subject'>, string> = {
  reviewer: 'VERIDION_REVIEWER_ADDRESSES',
  'senior-reviewer': 'VERIDION_SENIOR_REVIEWER_ADDRESSES',
  admin: 'VERIDION_ADMIN_ADDRESSES',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Resolve the roles an address holds. Reads the allowlist at call time (not at
 * module load) so a deployment can rotate staff without a rebuild, and so tests
 * can set env vars per-case.
 */
export function resolveRoles(
  address: string,
  env: Record<string, string | undefined> = process.env,
): Role[] {
  const roles: Role[] = ['subject'];
  for (const [role, envVar] of Object.entries(STAFF_ROLE_ENV) as [Exclude<Role, 'subject'>, string][]) {
    if (parseAllowlist(env[envVar]).includes(address)) roles.push(role);
  }
  return roles;
}

/** Whether a set of held roles satisfies a required role, honoring implication. */
export function hasRole(held: readonly Role[], required: Role): boolean {
  return held.some((role) => IMPLIES[role]?.includes(required));
}

/** Assert a required role. Returns a discriminated result rather than throwing,
 * matching `developer-api/auth.ts`'s style. */
export function requireRole(
  held: readonly Role[],
  required: Role,
): { ok: true } | { ok: false; status: 403; error: string } {
  if (hasRole(held, required)) return { ok: true };
  return { ok: false, status: 403, error: `This action requires the "${required}" role.` };
}
