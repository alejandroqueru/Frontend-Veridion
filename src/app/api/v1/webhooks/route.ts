import { randomBytes } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { authenticate } from '@/features/developer-api/auth';
import { getConsentStore } from '@/features/developer-api/consent-store';
import { getWebhookStore } from '@/features/developer-api/webhook-store';

// Webhook subscription management for registered apps. Requires an API key with
// the `manage:webhooks` scope.
//
//   POST   /api/v1/webhooks     { subject, url }   -> create (returns signing secret once)
//   GET    /api/v1/webhooks                        -> list this app's subscriptions
//   DELETE /api/v1/webhooks?id=                    -> delete one

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req.headers, 'manage:webhooks');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { subject?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const subject = typeof body.subject === 'string' ? body.subject : '';
  if (!STELLAR_ADDRESS.test(subject) && !subject.startsWith('tok_')) {
    return NextResponse.json({ error: 'Invalid subject.' }, { status: 400 });
  }
  if (!isHttpsUrl(body.url)) {
    return NextResponse.json({ error: 'A https `url` is required.' }, { status: 400 });
  }

  // The app must already hold the subject's consent to subscribe to their events.
  if (!(await getConsentStore().isGranted(auth.claims.appId, subject))) {
    return NextResponse.json(
      { error: 'User consent required before subscribing to their events.' },
      { status: 403 },
    );
  }

  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  const sub = await getWebhookStore().create({
    appId: auth.claims.appId,
    subject,
    url: body.url,
    secret,
  });

  // The signing secret is returned exactly once, at creation.
  return NextResponse.json(
    { id: sub.id, subject: sub.subject, url: sub.url, secret, createdAt: sub.createdAt },
    { status: 201 },
  );
}

export async function GET(req: NextRequest) {
  const auth = authenticate(req.headers, 'manage:webhooks');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const subs = await getWebhookStore().listForApp(auth.claims.appId);
  // Never expose stored secrets on list.
  const subscriptions = subs.map((s) => ({
    id: s.id,
    subject: s.subject,
    url: s.url,
    createdAt: s.createdAt,
  }));
  return NextResponse.json({ subscriptions });
}

export async function DELETE(req: NextRequest) {
  const auth = authenticate(req.headers, 'manage:webhooks');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Provide `id`.' }, { status: 400 });

  const deleted = await getWebhookStore().delete(id, auth.claims.appId);
  if (!deleted) return NextResponse.json({ error: 'Subscription not found.' }, { status: 404 });
  return NextResponse.json({ deleted: true, id });
}
