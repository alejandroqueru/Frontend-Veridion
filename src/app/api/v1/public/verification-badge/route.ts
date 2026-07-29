import { NextRequest, NextResponse } from 'next/server';

import { checkApiRateLimit } from '@/features/developer-api/rate-limit';
import { buildBadgeStatus } from '@/features/developer-api/public-badge';
import { getVerificationEvents } from '@/features/developer-api/verification-source';

// Public, unauthenticated badge endpoint used by the embeddable widget.
//
//   GET /api/v1/public/verification-badge?address=G...
//
// Unlike the authenticated data API, this deliberately requires no API key and
// returns ONLY a boolean verified/unverified state — the minimum a public badge
// needs, so no secret has to live in a third-party page and no score/category
// detail is leaked. It is rate-limited per client IP to prevent scraping.

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function GET(req: NextRequest) {
  // 120 badge lookups / minute per IP — generous for a page with a few badges,
  // tight enough to discourage bulk scraping.
  if (!checkApiRateLimit(`badge-ip:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  const address = new URL(req.url).searchParams.get('address');
  if (!address || !STELLAR_ADDRESS.test(address)) {
    return NextResponse.json({ error: 'Invalid Stellar address.' }, { status: 400 });
  }

  const events = await getVerificationEvents({ address });
  return NextResponse.json(buildBadgeStatus(events));
}
