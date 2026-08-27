import { Keypair } from '@stellar/stellar-sdk';

// Ed25519 signature verification against a Stellar public key.
//
// Isolated in its own module so the challenge/verify route stays about policy
// (expiry, single use, roles) and this stays about cryptography — and so tests
// can exercise it directly with deterministic keypairs.

/** Wallets return a SEP-43 `signedMessage` as base64. */
function decodeSignature(signature: string): Buffer | null {
  try {
    const decoded = Buffer.from(signature, 'base64');
    // Ed25519 signatures are always 64 bytes. Anything else is malformed, and
    // Buffer.from silently tolerates junk, so check rather than trust it.
    return decoded.length === 64 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Whether `signature` is a valid signature of `message` by `address`.
 *
 * Never throws: a malformed address or signature is simply "not verified".
 */
export function verifyMessageSignature(address: string, message: string, signature: string): boolean {
  if (typeof address !== 'string' || typeof message !== 'string' || typeof signature !== 'string') {
    return false;
  }

  const decoded = decodeSignature(signature);
  if (!decoded) return false;

  let keypair: Keypair;
  try {
    keypair = Keypair.fromPublicKey(address);
  } catch {
    return false;
  }

  try {
    return keypair.verify(Buffer.from(message, 'utf8'), decoded);
  } catch {
    return false;
  }
}
