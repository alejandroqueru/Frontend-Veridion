import { NextRequest, NextResponse } from 'next/server';

import { hasScope } from '@/features/developer-api/api-keys';
import { authenticate } from '@/features/developer-api/auth';
import { checkApiRateLimit } from '@/features/developer-api/rate-limit';
import { buildVerificationStatus } from '@/features/developer-api/status';
import { getVerificationEvents } from '@/features/developer-api/verification-source';

// Public, versioned endpoint:
//   GET /api/v1/verification-status?address=G...
//   GET /api/v1/verification-status?userToken=...
//
// Auth: send the API key as `Authorization: Bearer vrd_...` or `x-api-key`.
// Requires the `read:status` scope; keys that also hold `read:score` receive
// the per-category Human Score breakdown.

/** Stellar ed25519 public key: 'G' + 55 base32 chars. */
const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

export async function GET(req: NextRequest) {
  const auth = authenticate(req.headers, 'read:status');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!checkApiRateLimit(auth.claims.appId)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please retry later.' },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const userToken = searchParams.get('userToken');

  if (!address && !userToken) {
    return NextResponse.json(
      { error: 'Provide a Stellar `address` or a Veridion `userToken`.' },
      { status: 400 },
    );
  }
  if (address && !STELLAR_ADDRESS.test(address)) {
    return NextResponse.json({ error: 'Invalid Stellar address.' }, { status: 400 });
  }

  const events = await getVerificationEvents({
    address: address ?? undefined,
    userToken: userToken ?? undefined,
  });

  const body = buildVerificationStatus(events, {
    includeScoreBreakdown: hasScope(auth.claims, 'read:score'),
  });

  return NextResponse.json(body);
}
