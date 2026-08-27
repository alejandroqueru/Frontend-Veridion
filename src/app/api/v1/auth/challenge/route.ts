import { NextRequest, NextResponse } from 'next/server';

import { isStellarAddress } from '@/features/auth/address';
import { emitAuthEvent } from '@/features/auth/audit';
import { issueChallenge } from '@/features/auth/challenge-store';
import { buildChallengeMessage } from '@/features/auth/message';

// Step 1 of proving wallet ownership: hand out a nonce to sign.
//
// Deliberately unauthenticated — it is how a session begins. It reveals
// nothing: the response is a random nonce, and asking for a challenge for an
// address says nothing about whether that address is known to Veridion.

/** Issue a challenge: body { address }. */
export async function POST(req: NextRequest) {
  let body: { address?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { address } = body;
  if (!isStellarAddress(address)) {
    return NextResponse.json({ error: 'Provide a valid Stellar `address`.' }, { status: 400 });
  }

  const challenge = await issueChallenge(address);
  await emitAuthEvent({ type: 'auth.challenge.issued', address });

  // The message is returned rather than assembled client-side: the server
  // verifies against its own stored copy, so what the wallet displays and what
  // the signature is checked against are the same bytes by construction.
  return NextResponse.json({
    message: buildChallengeMessage(challenge),
    nonce: challenge.nonce,
    expiresAt: challenge.expiresAt,
  });
}
