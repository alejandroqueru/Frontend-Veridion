import { Keypair } from '@stellar/stellar-sdk';

import { issueChallenge } from '../challenge-store';
import { buildChallengeMessage } from '../message';
import { resolveRoles } from '../roles';
import { createSession } from '../session-store';
import { issueAccessToken } from '../tokens';

// Shared fixtures for the auth tests. Not a test file itself — vitest only
// collects `*.test.ts`, so this is safe to sit alongside them.

export const SESSION_SECRET = 'test-session-secret';

/** Deterministic keypairs: the same seed yields the same address every run, so
 * a failure reproduces instead of depending on which key was rolled. */
export function testKeypair(seed: number): Keypair {
  return Keypair.fromRawEd25519Seed(Buffer.alloc(32, seed));
}

export const ALICE = testKeypair(1);
export const BOB = testKeypair(2);

/** Point the session machinery at a known secret for the duration of a test. */
export function useTestSessionSecret(): void {
  process.env.VERIDION_SESSION_SECRET = SESSION_SECRET;
}

export function clearAuthEnv(): void {
  delete process.env.VERIDION_SESSION_SECRET;
  delete process.env.VERIDION_REVIEWER_ADDRESSES;
  delete process.env.VERIDION_SENIOR_REVIEWER_ADDRESSES;
  delete process.env.VERIDION_ADMIN_ADDRESSES;
}

export interface TestSession {
  address: string;
  accessToken: string;
  refreshToken: string;
  familyId: string;
  /** Ready-made `Authorization` header bag for a route handler. */
  headers: Headers;
}

/**
 * Open a real session for an address, the same way `/auth/verify` would.
 *
 * Roles come from `resolveRoles`, so a test that sets
 * `VERIDION_REVIEWER_ADDRESSES` before calling this gets a reviewer session
 * without special-casing anything.
 */
export async function openTestSession(address: string, device = 'vitest'): Promise<TestSession> {
  const roles = resolveRoles(address);
  const { family, refreshToken } = await createSession(address, roles, device);
  const accessToken = await issueAccessToken(
    { address, roles, familyId: family.familyId },
    SESSION_SECRET,
  );

  return {
    address,
    accessToken,
    refreshToken,
    familyId: family.familyId,
    headers: new Headers({ authorization: `Bearer ${accessToken}` }),
  };
}

/** Sign the live challenge for an address, as a wallet would. */
export async function signLiveChallenge(keypair: Keypair): Promise<string> {
  const challenge = await issueChallenge(keypair.publicKey());
  return keypair.sign(Buffer.from(buildChallengeMessage(challenge), 'utf8')).toString('base64');
}
