import type { VerificationEvent } from '@/features/scoring/types';

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION SEAM
//
// This is the single place where the public API reads a subject's verification
// history. Everything else (auth, scoring, response shaping) is already wired.
//
// Today the app has no server-side store of verification events keyed by Stellar
// address — verifications happen as OAuth callbacks and live client-side. Until
// that persistence exists, this returns an empty history, which the scoring
// engine correctly reports as an *unverified* subject (score 0). That is a
// truthful answer for an unknown address, not fabricated data.
//
// When a durable event store lands, implement the lookup here and nothing
// downstream needs to change.
// ─────────────────────────────────────────────────────────────────────────────

export interface SubjectRef {
  /** A Stellar public key (G...), when the caller queries by address. */
  address?: string;
  /** A Veridion-issued user token, when the caller queries by token. */
  userToken?: string;
}

export type VerificationLookup = (subject: SubjectRef) => Promise<VerificationEvent[]>;

const emptyLookup: VerificationLookup = async () => [];

let lookup: VerificationLookup = emptyLookup;

/** Wire in a real event source (e.g. once persistence exists, or in tests). */
export function setVerificationLookup(next: VerificationLookup): void {
  lookup = next;
}

/** Reset to the default (empty) lookup — primarily for tests. */
export function resetVerificationLookup(): void {
  lookup = emptyLookup;
}

export function getVerificationEvents(subject: SubjectRef): Promise<VerificationEvent[]> {
  return lookup(subject);
}
