import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import { verifyMessageSignature } from './verify-signature';

// Deterministic keypairs: the same seeds produce the same addresses on every
// run, so a failure is reproducible rather than a coin flip.
const ALICE = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
const MALLORY = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));

const MESSAGE = 'Veridion authentication request\n\nNonce: abc123';

function sign(keypair: Keypair, message: string): string {
  return keypair.sign(Buffer.from(message, 'utf8')).toString('base64');
}

describe('verifyMessageSignature', () => {
  it('accepts a signature made by the claimed address', () => {
    expect(verifyMessageSignature(ALICE.publicKey(), MESSAGE, sign(ALICE, MESSAGE))).toBe(true);
  });

  it('rejects a valid signature attributed to a different address', () => {
    expect(verifyMessageSignature(ALICE.publicKey(), MESSAGE, sign(MALLORY, MESSAGE))).toBe(false);
  });

  it('rejects a signature over different text', () => {
    expect(verifyMessageSignature(ALICE.publicKey(), MESSAGE, sign(ALICE, `${MESSAGE} `))).toBe(false);
  });

  it('rejects a malformed signature without throwing', () => {
    expect(verifyMessageSignature(ALICE.publicKey(), MESSAGE, 'not-base64!!')).toBe(false);
    expect(verifyMessageSignature(ALICE.publicKey(), MESSAGE, '')).toBe(false);
    // Right encoding, wrong length.
    expect(verifyMessageSignature(ALICE.publicKey(), MESSAGE, Buffer.alloc(32).toString('base64'))).toBe(false);
  });

  it('rejects a malformed address without throwing', () => {
    expect(verifyMessageSignature('not-an-address', MESSAGE, sign(ALICE, MESSAGE))).toBe(false);
    // A secret seed is not a public key.
    expect(verifyMessageSignature(ALICE.secret(), MESSAGE, sign(ALICE, MESSAGE))).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(verifyMessageSignature(ALICE.publicKey(), MESSAGE, null as never)).toBe(false);
  });
});
