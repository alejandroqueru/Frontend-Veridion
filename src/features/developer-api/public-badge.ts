import type { VerificationEvent } from '@/features/scoring/types';

import { buildVerificationStatus } from './status';

// The badge is intentionally the *most public* surface: it exposes only whether
// an address is verified — never the Human Score or any category detail. That is
// the minimum a "Verified by Veridion" badge needs, and it is safe to serve
// without an API key (a secret key must never live in a third-party page).

export interface BadgeStatus {
  verified: boolean;
  status: 'verified' | 'unverified';
}

export function buildBadgeStatus(events: VerificationEvent[], now?: number): BadgeStatus {
  const full = buildVerificationStatus(events, { includeScoreBreakdown: false, now });
  return { verified: full.verified, status: full.status };
}
