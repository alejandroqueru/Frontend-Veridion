/**
 * Single source of truth for the OAuth redirect_uri, used by both the
 * client (building the authorize URL before redirecting) and the server
 * route (exchanging the code — providers require the exact same
 * redirect_uri on both calls). Previously each provider hardcoded its own
 * value (some `/dashboard`, some a dead `/callback` route that doesn't
 * exist), which silently broke the token exchange for LinkedIn/GitHub-api.
 *
 * `origin` should be `window.location.origin` on the client or
 * `request.nextUrl.origin` on the server — both resolve to the same value
 * for a same-origin deployment. `NEXT_PUBLIC_APP_URL` is an explicit
 * override for deployments behind a proxy where those can diverge.
 */
export function getOAuthRedirectUri(origin?: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : undefined);

  if (!base) {
    throw new Error('Unable to determine OAuth redirect origin (set NEXT_PUBLIC_APP_URL)');
  }

  return `${base}/dashboard`;
}
