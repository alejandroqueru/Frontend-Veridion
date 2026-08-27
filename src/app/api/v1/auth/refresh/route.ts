import { NextRequest, NextResponse } from 'next/server';

import { emitAuthEvent } from '@/features/auth/audit';
import { sessionSecret } from '@/features/auth/request-session';
import { rotateRefreshToken } from '@/features/auth/session-store';
import { ACCESS_TOKEN_TTL_MS, issueAccessToken } from '@/features/auth/tokens';

// Exchange a refresh token for a fresh access token, rotating the refresh
// token in the process.
//
// Rotation is what makes a stolen refresh token detectable: the legitimate
// client and the attacker cannot both keep rotating the same chain, so the
// second one to present a superseded token trips reuse detection and the whole
// family dies. See `session-store.rotateRefreshToken`.

/** Rotate a session: body { refreshToken }. */
export async function POST(req: NextRequest) {
  const secret = sessionSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Server is not configured for session authentication.' }, { status: 500 });
  }

  let body: { refreshToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const presented = typeof body.refreshToken === 'string' ? body.refreshToken : null;
  if (!presented) {
    return NextResponse.json({ error: 'Provide a `refreshToken`.' }, { status: 400 });
  }

  const result = await rotateRefreshToken(presented);

  if (!result.ok) {
    if (result.reason === 'reuse-detected') {
      // Both events are emitted: the detection itself, and the revocation it
      // caused. An operator reading the audit log should not have to infer one
      // from the other.
      await emitAuthEvent({
        type: 'auth.refresh.reuse-detected',
        address: result.family.address,
        familyId: result.family.familyId,
        detail: { device: result.family.device },
      });
      await emitAuthEvent({
        type: 'auth.session.revoked',
        address: result.family.address,
        familyId: result.family.familyId,
        detail: { reason: 'refresh-token-reuse' },
      });
    } else if (result.reason === 'expired') {
      await emitAuthEvent({
        type: 'auth.session.revoked',
        address: result.family.address,
        familyId: result.family.familyId,
        detail: { reason: 'expired' },
      });
    }

    // One generic response for every failure — a caller must not be able to
    // tell "unknown token" from "you just burned this session".
    return NextResponse.json({ error: 'Session could not be refreshed. Sign in again.' }, { status: 401 });
  }

  const accessToken = await issueAccessToken(
    { address: result.family.address, roles: result.family.roles, familyId: result.family.familyId },
    secret,
  );

  await emitAuthEvent({
    type: 'auth.refresh.succeeded',
    address: result.family.address,
    familyId: result.family.familyId,
  });

  return NextResponse.json({
    address: result.family.address,
    roles: result.family.roles,
    familyId: result.family.familyId,
    accessToken,
    refreshToken: result.refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_MS,
  });
}
