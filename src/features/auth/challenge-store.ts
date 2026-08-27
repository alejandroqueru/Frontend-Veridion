import { randomBase64url } from './tokens';
import type { Challenge } from './types';

// Pending authentication challenges.
//
// Same convention as `developer-api/consent-store.ts`: a small interface with a
// default in-memory implementation, swappable via `setChallengeStore` for a
// Redis/KV-backed one in production. The in-memory default does not survive
// restarts or span instances — acceptable because a challenge lives for minutes
// and a lost one just means the user signs again.
//
// Two properties matter for security, and both live here rather than in the
// route so they cannot be forgotten at a call site:
//   * single use — `consume` removes the challenge, so a captured signature
//     cannot be replayed;
//   * short TTL — an expired challenge is never returned, even if still stored.
//
// Challenges are keyed by address, so an address has at most one live challenge
// and issuing a new one supersedes the old. That bounds what an unauthenticated
// caller can make the store hold, and it is why `/auth/verify` needs only
// `{ address, signature }`. The nonce still travels inside the signed message,
// binding a signature to the one specific challenge it answered.

/** How long a challenge stays signable. */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface ChallengeStore {
  put(challenge: Challenge): Promise<void>;
  /** Atomically fetch-and-delete the live challenge for an address. Returns
   * null if there is none, it was already used, or it expired — the caller
   * cannot tell these apart, and should not. */
  consume(address: string): Promise<Challenge | null>;
}

export class InMemoryChallengeStore implements ChallengeStore {
  private challenges = new Map<string, Challenge>();

  async put(challenge: Challenge): Promise<void> {
    this.sweep();
    this.challenges.set(challenge.address, challenge);
  }

  async consume(address: string): Promise<Challenge | null> {
    const found = this.challenges.get(address);
    // Delete unconditionally: an expired-but-present entry is spent either way.
    this.challenges.delete(address);
    if (!found) return null;
    if (found.expiresAt <= Date.now()) return null;
    return found;
  }

  /** Drop expired entries so an unused store cannot grow without bound. */
  private sweep(): void {
    const now = Date.now();
    for (const [key, challenge] of this.challenges) {
      if (challenge.expiresAt <= now) this.challenges.delete(key);
    }
  }
}

let store: ChallengeStore = new InMemoryChallengeStore();

/** Swap in a durable implementation (production) or a fresh one (tests). */
export function setChallengeStore(next: ChallengeStore): void {
  store = next;
}

/** Reset to a fresh in-memory store — primarily for tests. */
export function resetChallengeStore(): void {
  store = new InMemoryChallengeStore();
}

export function getChallengeStore(): ChallengeStore {
  return store;
}

/** Mint and persist a challenge for an address. */
export async function issueChallenge(address: string, now: number = Date.now()): Promise<Challenge> {
  const challenge: Challenge = {
    address,
    nonce: randomBase64url(24),
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
  };
  await getChallengeStore().put(challenge);
  return challenge;
}
