// Shared types for the identity/authorization platform.
//
// This platform authenticates *people* — end users proving control of a Stellar
// keypair, and staff holding an operator role. It is a deliberately separate
// axis from `features/developer-api`, which authenticates *applications* via
// API keys. Neither wraps the other.

/** Roles a session can carry. `subject` is implicit for every authenticated
 * address (it authorizes acting on your *own* data); the rest are staff roles
 * assigned from a server-held allowlist. */
export const ALL_ROLES = ['subject', 'reviewer', 'senior-reviewer', 'admin'] as const;

export type Role = (typeof ALL_ROLES)[number];

/** Claims carried inside a signed access token. Mirrors the compact
 * `ApiKeyClaims` shape used by `developer-api/api-keys.ts`. */
export interface SessionClaims {
  v: 1;
  /** The verified Stellar address this session belongs to. */
  sub: string;
  roles: Role[];
  /** Session family this access token was minted from — lets a refresh, a
   * revocation, and an audit entry all point at the same device session. */
  fid: string;
  /** Issued-at, epoch ms. */
  iat: number;
  /** Expiry, epoch ms. Access tokens are deliberately short-lived. */
  exp: number;
}

export type VerifyTokenFailure =
  | 'malformed'
  | 'bad-signature'
  | 'invalid-claims'
  | 'expired';

export type VerifyTokenResult =
  | { ok: true; claims: SessionClaims }
  | { ok: false; reason: VerifyTokenFailure };

/** A pending, single-use authentication challenge. */
export interface Challenge {
  address: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

/** A session *family*: one device's continuous session, across every refresh
 * rotation it goes through. Revoking the family signs that device out. */
export interface SessionFamily {
  familyId: string;
  address: string;
  roles: Role[];
  /** SHA-256 of the currently valid refresh token. The raw token is never
   * stored — a store dump must not be replayable as credentials. */
  currentRefreshTokenHash: string;
  createdAt: number;
  lastRotatedAt: number;
  /** User-agent fingerprint captured at issuance, for the device list. */
  device: string;
}

/** Every authentication-lifecycle event this platform emits. The audit
 * platform (issue #30) owns hash-chained storage and integrity verification;
 * this feature owns defining and emitting these types. */
export type AuthEventType =
  | 'auth.challenge.issued'
  | 'auth.verify.succeeded'
  | 'auth.verify.failed'
  | 'auth.refresh.succeeded'
  | 'auth.refresh.reuse-detected'
  | 'auth.session.revoked';

export interface AuthEvent {
  type: AuthEventType;
  /** Address the event concerns, when known. */
  address?: string;
  familyId?: string;
  at: number;
  /** Non-sensitive detail — never a token, signature, or secret. */
  detail?: Record<string, string | number | boolean>;
}
