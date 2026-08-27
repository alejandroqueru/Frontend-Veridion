// Cheap shape validation for a Stellar public key.
//
// This is a gate, not a proof: it rejects obvious junk before any work is done.
// The authoritative check is `verifyMessageSignature`, which decodes the key
// properly (checksum included) and can only succeed against a real keypair.

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

export function isStellarAddress(value: unknown): value is string {
  return typeof value === 'string' && STELLAR_ADDRESS.test(value);
}
