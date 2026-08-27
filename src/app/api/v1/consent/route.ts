import { NextRequest, NextResponse } from 'next/server';

import { requireSession } from '@/features/auth/guard';
import { requireSelf } from '@/features/auth/request-session';
import { getConsentStore } from '@/features/developer-api/consent-store';

// User-facing consent management. These represent actions taken by the *user*
// (the data owner), not by a third-party app, so they are NOT gated by an API
// key — they are gated by a session proving control of the Stellar address in
// question.
//
// That session requirement closes the gap this file used to carry: `subject`
// arrived as a plain string the server trusted, so anyone could grant or revoke
// consent on someone else's behalf. Now `subject` must equal the address whose
// wallet signature opened the session, and holding a staff role does not help —
// this is the subject's own data, and only the subject acts on it.

/** Every handler here does the same two checks; doing them in one place keeps
 * them from drifting apart between the three verbs. */
async function authorizeSubject(req: NextRequest, subject: string) {
  const auth = await requireSession(req.headers);
  if (!auth.ok) return auth;

  const self = requireSelf(auth.session, subject);
  if (!self.ok) return self;

  return auth;
}

/** Grant consent: body { appId, subject }. Requires a session for `subject`. */
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

  const auth = await authorizeSubject(req, subject);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await getConsentStore().grant(appId, subject);
  return NextResponse.json({ granted: true, appId, subject });
}

/** Revoke consent: query ?appId=&subject=. Takes effect immediately. */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');
  const subject = searchParams.get('subject');
  if (!appId || !subject) {
    return NextResponse.json({ error: 'Provide `appId` and `subject`.' }, { status: 400 });
  }

  const auth = await authorizeSubject(req, subject);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await getConsentStore().revoke(appId, subject);
  return NextResponse.json({ revoked: true, appId, subject });
}

/** List an owner's active grants: query ?subject=. Powers the dashboard. */
export async function GET(req: NextRequest) {
  const subject = new URL(req.url).searchParams.get('subject');
  if (!subject) {
    return NextResponse.json({ error: 'Provide `subject`.' }, { status: 400 });
  }

  const auth = await authorizeSubject(req, subject);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const grants = await getConsentStore().listForSubject(subject);
  return NextResponse.json({ subject, grants });
}
