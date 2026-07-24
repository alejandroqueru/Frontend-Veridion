# Veridion Public Developer API

A public, authenticated API that lets a third-party Stellar app ask _"is this
address verified, and to what extent?"_ without integrating Veridion's internals.

This document covers the first slice that is implemented today: **API keys, the
`verification-status` endpoint, scopes, and rate limits.** Consent, the
embeddable widget, and webhooks are on the roadmap (see the end of this file).

## Authentication

Every request must present an **API key**. A key is a signed token of the form:

```
vrd_<base64url(claims)>.<base64url(HMAC-SHA256(payload, secret))>
```

The claims (`appId`, `scopes`, …) are embedded in and signed into the key, so
the server authenticates it by verifying the signature — no database lookup
required. Only Veridion holds the signing secret, so a key cannot be forged or
altered.

Send the key using either header:

```
Authorization: Bearer vrd_...
# or
x-api-key: vrd_...
```

### Getting a key

Self-service registration is coming (see Roadmap). Today an operator mints a key
with the signing secret:

```bash
VERIDION_API_KEY_SECRET=... node scripts/issue-api-key.mjs "Your App" read:status
```

Server configuration:

| Env var                    | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `VERIDION_API_KEY_SECRET`  | HMAC secret used to sign and verify keys. |

## Scopes

Keys are least-privilege. A key carries one or more scopes:

| Scope         | Grants                                                     |
| ------------- | --------------------------------------------------------- |
| `read:status` | Read a subject's `verified` / `unverified` status.        |
| `read:score`  | Additionally read the per-category Human Score breakdown. |

A request to an endpoint without the required scope returns `403`.

## Endpoint: `GET /api/v1/verification-status`

Returns a subject's verification status and Human Score. Requires `read:status`.

Query by **one** of:

| Param       | Description                        |
| ----------- | --------------------------------- |
| `address`   | A Stellar public key (`G...`).    |
| `userToken` | A Veridion-issued user token.     |

### Example

```bash
curl "https://<host>/api/v1/verification-status?address=GABC...XYZ" \
  -H "Authorization: Bearer vrd_..."
```

Response (`200`):

```json
{
  "verified": true,
  "status": "verified",
  "humanScore": 6,
  "schemaVersion": "v1",
  "categories": [
    { "category": "social", "label": "Social", "earnedPoints": 6, "cap": 24 }
  ]
}
```

`categories` is included only when the key also holds `read:score`.

### Status codes

| Status | Meaning                                                        |
| ------ | ------------------------------------------------------------- |
| `200`  | OK.                                                           |
| `400`  | Missing/invalid `address` or `userToken`.                    |
| `401`  | Missing or invalid API key.                                  |
| `403`  | Key lacks the required scope.                                |
| `429`  | Per-key rate limit exceeded.                                 |
| `500`  | Server is not configured with a signing secret.             |

## Rate limits

Each key gets **60 requests per minute** (`api:<appId>`), enforced by the shared
token-bucket in `src/features/verifications/services/rate-limiter.ts`. Exceeding
it returns `429`.

## Embeddable badge widget

A drop-in "Verified by Veridion" badge for third-party sites.

```html
<div data-veridion-badge data-address="GABC...XYZ"></div>
<script src="https://<host>/veridion-badge.js" async></script>
```

The loader replaces each element with an `<iframe>` pointing at
`/embed/verification-badge?address=...`, so the badge is fully isolated from the
host page (no data leaks in either direction). You can also embed that iframe
directly.

The badge is driven by a **public, unauthenticated** endpoint that returns only
the verified/unverified state — never the Human Score or category detail — so no
API key ever has to live in a third-party page:

```
GET /api/v1/public/verification-badge?address=G...   ->  { "verified": bool, "status": "verified"|"unverified" }
```

It is rate-limited per client IP (120/min). The badge degrades gracefully to a
clear **verified / not verified / unavailable** state on any error.

## User consent & revocation

A valid API key is **not** enough to read a specific subject's data — the subject
must have explicitly authorized the app, and can revoke that at any time.

- The authenticated `verification-status` endpoint checks consent for
  `(appId, subject)` on every request and returns `403` when it is missing.
- Users authorize/revoke via the consent screen (`/consent?appId=&appName=&subject=`)
  or the consent API:

  ```
  POST   /api/v1/consent            { "appId": "...", "subject": "G..." }   grant
  DELETE /api/v1/consent?appId=&subject=                                    revoke (immediate)
  GET    /api/v1/consent?subject=                                           list a subject's grants
  ```

Consent is the one part of the API that **cannot be stateless** — immediate
revocation requires durable, mutable state. It lives behind the
`ConsentStore` interface (`src/features/developer-api/consent-store.ts`). The
default implementation is **in-memory** (fine for a demo / single instance, but
it does not survive restarts or span instances); swap in a durable
implementation via `setConsentStore` for production — no other code changes.

> DEMO NOTE: the consent API is not yet gated by user authentication. In
> production these endpoints must verify the caller owns `subject` (e.g. a
> Stellar wallet signature); otherwise anyone could grant/revoke on another
> user's behalf.

## Roadmap (needs durable storage)

These need the same kind of **durable server-side storage** and are the natural
next steps once a store is chosen:

- **Verification data source.** `src/features/developer-api/verification-source.ts`
  is the single integration seam. It currently returns an empty history (so
  unknown addresses correctly read as `unverified`); wire a real event store
  there and every endpoint — API and badge — starts returning live data.
- **Durable `ConsentStore`** (Redis/Postgres/KV) replacing the in-memory default.
- **Webhooks** for verification-status changes, with signed payloads and
  retry/backoff.
- **Shared rate-limit store** so limits survive restarts and span instances.

See issue #12 for the full feature description.
