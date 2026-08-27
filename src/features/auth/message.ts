import type { Challenge } from './types';

// The exact bytes a user signs to prove wallet ownership.
//
// The template is fixed and rebuilt server-side from the *stored* challenge, so
// a client cannot influence what was signed by echoing back a different
// message. It is human-readable on purpose: a wallet shows this text to the
// user, and it must be obvious what they are approving.
//
// It is deliberately NOT a valid Stellar transaction envelope — a signature
// produced here can never be replayed as an on-chain operation.

export const CHALLENGE_MESSAGE_HEADER = 'Veridion authentication request';

/** Build the canonical message for a challenge. Must stay byte-stable: any
 * change here invalidates in-flight challenges (they expire in minutes). */
export function buildChallengeMessage(challenge: Challenge): string {
  return [
    CHALLENGE_MESSAGE_HEADER,
    '',
    'Sign this message to prove you control this address.',
    'This request will not move funds or submit a transaction.',
    '',
    `Address: ${challenge.address}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${new Date(challenge.issuedAt).toISOString()}`,
    `Expires At: ${new Date(challenge.expiresAt).toISOString()}`,
  ].join('\n');
}
