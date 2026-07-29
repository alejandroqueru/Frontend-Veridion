import type { RetentionPolicy } from './types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * Data-driven retention policy registry.
 *
 * All retention windows are defined here — nothing in the codebase
 * hardcodes a retention duration at a call site. The retention engine
 * reads this array; adding or modifying a category requires only a
 * change to this file.
 */
export const RETENTION_POLICIES: readonly RetentionPolicy[] = [
  {
    category: 'otp',
    verificationCategory: null, // OTP records are in-memory server-side, not in localStorage
    windowMs: 10 * MINUTE_MS,
    label: 'OTP Records',
    description: 'One-time passwords are discarded automatically after 10 minutes.',
  },
  {
    category: 'machine-session',
    verificationCategory: null, // machines{} in verification-store (ephemeral UX state)
    windowMs: 24 * HOUR_MS,
    label: 'Session State',
    description:
      'In-flight verification session state (e.g. pending OAuth redirects) expires after 24 hours.',
  },
  {
    category: 'social',
    verificationCategory: 'social',
    windowMs: 2 * YEAR_MS,
    label: 'Social Verifications',
    description:
      'Social provider verifications (Google, GitHub, LinkedIn, Discord) are retained for 2 years.',
  },
  {
    category: 'physical',
    verificationCategory: 'physical',
    windowMs: 5 * YEAR_MS,
    label: 'Physical Verifications',
    description:
      'Physical identity verifications (Government ID, biometrics, phone, email) are retained for 5 years.',
  },
  {
    category: 'blockchain',
    verificationCategory: 'blockchain',
    windowMs: 5 * YEAR_MS,
    label: 'Blockchain Verifications',
    description: 'Blockchain transaction proofs (Stellar) are retained for 5 years.',
  },
  {
    category: 'audit-log',
    verificationCategory: null,
    windowMs: 7 * YEAR_MS,
    label: 'Audit Log',
    description:
      'Consent and access audit log entries are kept for 7 years to satisfy regulatory requirements and can never be purged early.',
  },
] as const;

/** Convenience lookup by verificationCategory string → policy. */
export function getPolicyForCategory(verificationCategory: string): RetentionPolicy | undefined {
  return RETENTION_POLICIES.find((p) => p.verificationCategory === verificationCategory);
}

/** Convenience lookup by RetentionCategory key. */
export function getPolicyByKey(category: RetentionPolicy['category']): RetentionPolicy | undefined {
  return RETENTION_POLICIES.find((p) => p.category === category);
}
