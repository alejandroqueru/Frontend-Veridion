import { NextRequest, NextResponse } from 'next/server';

import { getConsentStore } from '@/features/developer-api/consent-store';

// User-facing consent management. These represent actions taken by the *user*
// (the data owner), not by a third-party app, so they are NOT gated by an API
// key.
//
// DEMO NOTE: in production these MUST be authenticated as the user (e.g. a
// Stellar wallet signature proving ownership of `subject`) — otherwise anyone
// could grant/revoke consent on someone else's behalf. That user-auth layer is
// out of scope for this demo; the flow and enforcement are what's shown here.

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

function isValidSubject(subject: string | null): subject is string {
  return typeof subject === 'string' && subject.length > 0;
}

/** Grant consent: body { appId, subject }. */
export async function POST(req: NextRequest) {
  let body: { appId?: unknown; subject?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const appId = typeof body.appId === 'string' ? body.appId : '';
  const subject = typeof body.subject === 'string' ? body.subject : '';
  if (!appId || !subject) {
    return NextResponse.json({ error: 'Provide `appId` and `subject`.' }, { status: 400 });
  }
  if (STELLAR_ADDRESS.test(subject) === false && !subject.startsWith('tok_')) {
    // Accept a Stellar address or a Veridion user token (tok_...).
    return NextResponse.json({ error: 'Invalid subject.' }, { status: 400 });
  }

  await getConsentStore().grant(appId, subject);
  return NextResponse.json({ granted: true, appId, subject });
}

/** Revoke consent: query ?appId=&subject=. Takes effect immediately. */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');
  const subject = searchParams.get('subject');
  if (!isValidSubject(appId) || !isValidSubject(subject)) {
    return NextResponse.json({ error: 'Provide `appId` and `subject`.' }, { status: 400 });
  }

  await getConsentStore().revoke(appId, subject);
  return NextResponse.json({ revoked: true, appId, subject });
}

/** List an owner's active grants: query ?subject=. Powers the dashboard. */
export async function GET(req: NextRequest) {
  const subject = new URL(req.url).searchParams.get('subject');
  if (!isValidSubject(subject)) {
    return NextResponse.json({ error: 'Provide `subject`.' }, { status: 400 });
  }

  const grants = await getConsentStore().listForSubject(subject);
  return NextResponse.json({ subject, grants });
}
