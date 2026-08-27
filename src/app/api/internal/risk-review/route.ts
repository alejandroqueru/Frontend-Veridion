import { NextRequest, NextResponse } from 'next/server';

import { requireSession } from '@/features/auth/guard';
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
// Access requires a session carrying the `reviewer` role. This replaces the
// former `RISK_REVIEW_TOKEN` shared secret, which gave every reviewer the same
// credential and so recorded no per-person identity: an audit entry could say
// "someone with the token looked at flagged accounts" and nothing more. A
// session names the individual reviewer, can be revoked for one person without
// re-keying everyone, and is checked by the same `requireSession` every other
// protected route uses.

const DEFAULT_MIN_SCORE = 50;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const auth = await requireSession(req.headers, { role: 'reviewer' });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
