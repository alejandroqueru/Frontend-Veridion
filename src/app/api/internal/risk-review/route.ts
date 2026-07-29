import { NextRequest, NextResponse } from 'next/server';

import { listFlaggedAssessments } from '@/features/risk-signals/service';

// Minimal internal review-workflow endpoint: lists accounts whose risk
// score is at or above a threshold, for a human reviewer to triage. This is
// the read side of the risk-signals issue's "internal interface...
// consumable by other features (e.g. a future review workflow)"
// requirement — deliberately basic (no pagination cursor, no per-signal
// filtering, no UI): the point is that flagged accounts are queryable at
// all, not a polished admin panel. It never touches the Human Score or
// verification-store — see `features/risk-signals/service.ts`.
//
// DEMO NOTE, same caveat as api/v1/consent: gated by a single shared secret
// (`RISK_REVIEW_TOKEN`) rather than a real admin auth/session system — this
// repo has none. Production should replace this with whatever internal-
// staff auth the rest of the app ends up using.

const DEFAULT_MIN_SCORE = 50;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Avoids leaking the configured token's value through response-time
// differences on a char-by-char short-circuit compare. Not worth reaching
// for node:crypto's timingSafeEqual (which requires equal-length Buffers
// anyway) for a string this short.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.RISK_REVIEW_TOKEN;
  // Fail closed: no token configured means no access, never open access.
  if (!expected) return false;
  const provided = req.headers.get('x-internal-token');
  return provided !== null && timingSafeEqual(provided, expected);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const minScoreParam = searchParams.get('minScore');
  const minScore = minScoreParam !== null ? Number(minScoreParam) : DEFAULT_MIN_SCORE;
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
    return NextResponse.json({ error: 'Invalid minScore — expected a number between 0 and 100.' }, { status: 400 });
  }

  const limitParam = searchParams.get('limit');
  const limit = limitParam !== null ? Number(limitParam) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json({ error: `Invalid limit — expected an integer between 1 and ${MAX_LIMIT}.` }, { status: 400 });
  }

  const assessments = await listFlaggedAssessments(minScore, limit);
  return NextResponse.json({ assessments });
}
