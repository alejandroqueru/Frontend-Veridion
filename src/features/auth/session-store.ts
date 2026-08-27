import { REFRESH_TOKEN_TTL_MS, hashToken, issueRefreshToken, parseRefreshToken } from './tokens';
import type { Role, SessionFamily } from './types';

// Durable session families — one record per signed-in device.
//
// Same swappable-store convention as `developer-api/consent-store.ts`. Sessions
// are the one part of this platform that CANNOT be stateless: revocation and
// refresh-reuse detection both require mutable server state.
//
// Only the *hash* of the current refresh token is retained, so a dump of this
// store is not a set of usable credentials.

export interface SessionStore {
  put(family: SessionFamily): Promise<void>;
  get(familyId: string): Promise<SessionFamily | null>;
  listForAddress(address: string): Promise<SessionFamily[]>;
  delete(familyId: string): Promise<void>;
  deleteForAddress(address: string): Promise<number>;
}

export class InMemorySessionStore implements SessionStore {
  private families = new Map<string, SessionFamily>();

  async put(family: SessionFamily): Promise<void> {
    this.families.set(family.familyId, family);
  }

  async get(familyId: string): Promise<SessionFamily | null> {
    return this.families.get(familyId) ?? null;
  }

  async listForAddress(address: string): Promise<SessionFamily[]> {
    return [...this.families.values()].filter((f) => f.address === address);
  }

  async delete(familyId: string): Promise<void> {
    this.families.delete(familyId);
  }

  async deleteForAddress(address: string): Promise<number> {
    let removed = 0;
    for (const [id, family] of this.families) {
      if (family.address === address) {
        this.families.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

let store: SessionStore = new InMemorySessionStore();

/** Swap in a durable implementation (production) or a fresh one (tests). */
export function setSessionStore(next: SessionStore): void {
  store = next;
}

/** Reset to a fresh in-memory store — primarily for tests. */
export function resetSessionStore(): void {
  store = new InMemorySessionStore();
}

export function getSessionStore(): SessionStore {
  return store;
}

export interface CreatedSession {
  family: SessionFamily;
  /** The raw refresh token — returned to the caller exactly once. */
  refreshToken: string;
}

/** Open a new session family for a freshly verified address. */
export async function createSession(
  address: string,
  roles: Role[],
  device: string,
  now: number = Date.now(),
): Promise<CreatedSession> {
  const familyId = crypto.randomUUID();
  const refreshToken = issueRefreshToken(familyId);
  const family: SessionFamily = {
    familyId,
    address,
    roles,
    currentRefreshTokenHash: await hashToken(refreshToken),
    createdAt: now,
    lastRotatedAt: now,
    device,
  };
  await store.put(family);
  return { family, refreshToken };
}

export type RotateResult =
  /** Rotation succeeded; `refreshToken` supersedes the presented one. */
  | { ok: true; family: SessionFamily; refreshToken: string }
  /** The token named no known family, or was unparseable. Nothing was revoked. */
  | { ok: false; reason: 'unknown' }
  /** The family expired for want of use; it has been dropped. */
  | { ok: false; reason: 'expired'; family: SessionFamily }
  /** A rotated-out token was presented again. Treated as compromise: the whole
   * family is revoked, not just this token. */
  | { ok: false; reason: 'reuse-detected'; family: SessionFamily };

/**
 * Rotate a refresh token.
 *
 * Every use issues a new token and invalidates the old one. Presenting a token
 * that was already rotated out means either an attacker replaying a stolen
 * token or the legitimate client replaying one — and the server cannot tell
 * which. Both are handled the same way: revoke the entire family and force a
 * fresh wallet signature. Losing one session beats leaving a stolen token live.
 */
export async function rotateRefreshToken(
  presented: string | null | undefined,
  now: number = Date.now(),
): Promise<RotateResult> {
  if (typeof presented !== 'string') return { ok: false, reason: 'unknown' };

  const parsed = parseRefreshToken(presented);
  if (!parsed) return { ok: false, reason: 'unknown' };

  const family = await store.get(parsed.familyId);
  if (!family) return { ok: false, reason: 'unknown' };

  if (now - family.lastRotatedAt >= REFRESH_TOKEN_TTL_MS) {
    await store.delete(family.familyId);
    return { ok: false, reason: 'expired', family };
  }

  const presentedHash = await hashToken(presented);
  if (presentedHash !== family.currentRefreshTokenHash) {
    await store.delete(family.familyId);
    return { ok: false, reason: 'reuse-detected', family };
  }

  const refreshToken = issueRefreshToken(family.familyId);
  const rotated: SessionFamily = {
    ...family,
    currentRefreshTokenHash: await hashToken(refreshToken),
    lastRotatedAt: now,
  };
  await store.put(rotated);
  return { ok: true, family: rotated, refreshToken };
}
