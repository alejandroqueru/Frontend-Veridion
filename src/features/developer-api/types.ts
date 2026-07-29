// Public developer API — shared types.
//
// The API is intentionally *stateless* for authentication: an API key is a
// signed token that carries its own claims (see `api-keys.ts`). This lets a
// third-party app authenticate without a database lookup on every request.
//
// NOTE: revoking a key (or a user's consent) is the one thing that cannot be
// done statelessly — that requires a small durable bl- / allow-list. See
// `docs/public-api.md` ("Roadmap") for where that hook belongs.

/** Granular permissions a key can carry. Keep these coarse and additive. */
export type ApiScope =
  | 'read:status' // may read a subject's verified/unverified status
  | 'read:score' // may additionally read the Human Score breakdown
  | 'manage:webhooks'; // may create/list/delete webhook subscriptions

export const ALL_SCOPES: ApiScope[] = ['read:status', 'read:score', 'manage:webhooks'];

/** Claims embedded inside (and signed into) an API key. */
export interface ApiKeyClaims {
  /** Token format version, so the format can evolve without ambiguity. */
  v: 1;
  /** Stable id of the registered application. */
  appId: string;
  /** Human-friendly application name (for logs / dashboards). */
  appName: string;
  /** Scopes this key is allowed to exercise. */
  scopes: ApiScope[];
  /** Issued-at, epoch milliseconds. */
  iat: number;
}

export type VerifyKeyResult =
  | { ok: true; claims: ApiKeyClaims }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'invalid-claims' };
