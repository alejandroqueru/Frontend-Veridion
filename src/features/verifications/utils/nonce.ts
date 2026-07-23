/**
 * Per-attempt CSRF/resume token. Replaces the old hardcoded literal
 * `'github_verification'` style `state` params — those let any stale
 * callback (or another tab's attempt) be accepted as valid.
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
