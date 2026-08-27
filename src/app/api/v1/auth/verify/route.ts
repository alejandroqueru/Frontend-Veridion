import { NextRequest, NextResponse } from 'next/server';

import { isStellarAddress } from '@/features/auth/address';
import { emitAuthEvent } from '@/features/auth/audit';
import { getChallengeStore } from '@/features/auth/challenge-store';
import { buildChallengeMessage } from '@/features/auth/message';
import { deviceFrom, sessionSecret } from '@/features/auth/request-session';
import { resolveRoles } from '@/features/auth/roles';
import { createSession } from '@/features/auth/session-store';
import { ACCESS_TOKEN_TTL_MS, issueAccessToken } from '@/features/auth/tokens';
import { verifyMessageSignature } from '@/features/auth/verify-signature';

// Step 2 of proving wallet ownership: check the signature and open a session.
//
// Every failure returns the same generic message. Telling a caller whether the
// challenge was missing, expired, already spent, or the signature simply did
// not match would hand an attacker a probing oracle; the audit log records the
// real reason for operators.

/** Verify a signed challenge: body { address, signature }. */
export async function POST(req: NextRequest) {
  const secret = sessionSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Server is not configured for session authentication.' }, { status: 500 });
  }

  let body: { address?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { address, signature } = body;
  if (!isStellarAddress(address) || typeof signature !== 'string' || signature.length === 0) {
    return NextResponse.json({ error: 'Provide a valid Stellar `address` and a `signature`.' }, { status: 400 });
  }

  const rejected = async (reason: string) => {
    await emitAuthEvent({ type: 'auth.verify.failed', address, detail: { reason } });
    return NextResponse.json({ error: 'Could not verify this signature.' }, { status: 401 });
  };

  // Consuming first means a replayed signature finds nothing left to verify,
  // even if it was valid the first time.
  const challenge = await getChallengeStore().consume(address);
  if (!challenge) return rejected('no-live-challenge');

  if (!verifyMessageSignature(address, buildChallengeMessage(challenge), signature)) {
    return rejected('bad-signature');
  }

  const roles = resolveRoles(address);
  const { family, refreshToken } = await createSession(address, roles, deviceFrom(req.headers));
  const accessToken = await issueAccessToken(
    { address, roles, familyId: family.familyId },
    secret,
  );

  await emitAuthEvent({
    type: 'auth.verify.succeeded',
    address,
    familyId: family.familyId,
    detail: { roles: roles.join(','), device: family.device },
  });

  return NextResponse.json({
    address,
    roles,
    familyId: family.familyId,
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_MS,
  });
}
