# Veridion Identity & Authorization

How Veridion authenticates **people** — end users acting on their own data, and
staff acting in an operator role.

This is a separate axis from [`public-api.md`](./public-api.md), which
authenticates **applications** with `vrd_` API keys. Neither wraps the other: a
key is never accepted as a person, a session is never accepted as a key, and the
existing third-party key contract is unchanged.

## Why it exists

Connecting a wallet proves nothing. A browser extension reports whatever public
key it likes, and until now the app believed it: `/api/v1/consent` took `subject`
as a plain string, `/api/internal/risk-review` was gated by one shared secret
that every reviewer held in common, and `/admin/review` gated on a client-side
boolean. Anyone could grant or revoke consent on someone else's behalf.

A session is only issued after the caller **signs a challenge** with the private
key for the address they claim.

## The flow

```
POST /api/v1/auth/challenge   { address }              -> { message, nonce, expiresAt }
                              (user signs `message` in their wallet)
POST /api/v1/auth/verify      { address, signature }   -> { accessToken, refreshToken, roles, familyId }
POST /api/v1/auth/refresh     { refreshToken }         -> a new pair; the old refresh token dies
GET    /api/v1/auth/sessions                            -> this address's devices
DELETE /api/v1/auth/sessions/:familyId                  -> revoke one device
DELETE /api/v1/auth/sessions                            -> sign out everywhere
```

Protected requests carry `Authorization: Bearer vsa_...`.

The challenge is **single-use** and expires in 5 minutes. Verifying consumes it,
so a captured signature cannot be replayed. The message is rebuilt server-side
from the stored challenge, so what the wallet displayed and what the signature is
checked against are the same bytes by construction.

## Tokens

| Token     | Form                                 | Lifetime | Stored where                          |
| --------- | ------------------------------------ | -------- | ------------------------------------- |
| Access    | `vsa_<claims>.<HMAC>`, self-contained | 10 min   | Client memory only                    |
| Refresh   | `vsr_<familyId>.<random>`, opaque    | 30 days  | Client `sessionStorage`; server keeps only its SHA-256 |

Access tokens carry their claims inside them and are verified by signature
alone — the same design as `vrd_` API keys, so no store lookup is needed to
authenticate one. Never `localStorage`: sessions expire, and a credential that
outlives the browsing session silently outlives its TTL.

### Refresh rotation and reuse detection

Every refresh issues a new refresh token and invalidates the presented one. A
**session family** is one device's session across all its rotations.

Presenting a token that was already rotated out means either an attacker
replaying a stolen token or the legitimate client replaying one — and the server
cannot tell which. Both are treated as compromise: **the entire family is
revoked**, not just that token, and the user signs again. Losing one session
beats leaving a stolen token live.

## Roles

`subject` · `reviewer` · `senior-reviewer` · `admin`

Every authenticated address implicitly holds `subject`, which authorizes acting
on **its own** data. Staff roles come from a server-held allowlist, resolved
fresh on every request — removing an address takes effect at the next request,
not at the next token expiry.

```bash
VERIDION_SESSION_SECRET=...                  # HMAC secret for session tokens (required)
VERIDION_REVIEWER_ADDRESSES=G...,G...        # comma-separated allowlists
VERIDION_SENIOR_REVIEWER_ADDRESSES=G...
VERIDION_ADMIN_ADDRESSES=G...
```

`admin` implies `senior-reviewer` implies `reviewer`. Implication never runs the
other way, and a staff role never confers `subject` authority over someone
else's data — an admin cannot grant consent on your behalf.

## Enforcement

Two layers, one implementation:

- **`src/middleware.ts`** — a fail-closed pre-filter on every protected path. It
  runs in the edge runtime, so it verifies the token cryptographically and checks
  the coarse role, but cannot consult the session store.
- **`requireSession`** (`src/features/auth/guard.ts`) — the authoritative check
  inside each handler: session still live, roles resolved fresh, and for
  subject-scoped routes, `session.address === subject`.

Both call the same verification code, so there is one implementation applied
twice rather than two that drift apart. Routes do not write their own checks.

> `/admin/review` is deliberately **not** in the middleware matcher. Session
> tokens live in `sessionStorage`, so a document navigation carries no credential
> middleware could read. That page asks the server who the caller is and gates on
> the answer — but it is UX, not the boundary. The flagged-account data behind it
> comes from `api/internal/risk-review`, which independently requires `reviewer`.

## Audit

Every challenge issuance, successful and failed verification, refresh, rotation
reuse detection, and revocation is emitted as a typed `AuthEvent`
(`src/features/auth/types.ts`). Tokens and signatures are never recorded.

Events go to a swappable sink with an in-memory default. The application-wide
audit platform ([issue #30](https://github.com/Veridion-Id/Frontend-Veridion/issues/30))
owns hash-chained, tamper-evident storage; wiring it in is `setAuthAuditSink(...)`
and no other change to this feature.

## Storage

`challenge-store`, `session-store` and the audit sink all follow the same
convention as `consent-store`: a small interface with an in-memory default,
swappable via `set*Store`. The defaults do not survive restarts or span
instances — fine for a demo, replace for production.
