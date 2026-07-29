import { NextRequest, NextResponse } from 'next/server';

import { recordVerificationSignal } from '@/features/risk-signals/service';
import { checkRateLimit } from '@/features/verifications/services/rate-limiter';

// Ingestion endpoint for the device/browser risk signal, called by
// `features/risk-signals/hooks/use-risk-signal-reporter.ts` right after a
// provider verification completes. Deliberately placed under `api/internal`
// rather than `api/v1` — this is NOT part of the versioned public developer
// API (see docs/public-api.md); it is not authenticated with a third-party
// API key, and it never returns score/signal data, only an ack. Reading a
// risk assessment is only possible server-side via
// `features/risk-signals/service.ts#getRiskAssessment`.
//
// DEMO NOTE, same caveat as `api/v1/consent`: this isn't authenticated as
// the user, so `subject` is trusted as given. Production should verify it
// against the caller's session/wallet signature before recording.

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

function isValidSubject(subject: unknown): subject is string {
  return typeof subject === 'string' && (STELLAR_ADDRESS.test(subject) || subject.startsWith('tok_'));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { subject, fingerprint, providerId, phone } = body;

  if (!isValidSubject(subject)) {
    return NextResponse.json({ error: 'Invalid subject.' }, { status: 400 });
  }
  if (typeof fingerprint !== 'string' || fingerprint.length < 16 || fingerprint.length > 128) {
    return NextResponse.json({ error: 'Invalid fingerprint.' }, { status: 400 });
  }
  if (typeof providerId !== 'string' || providerId.length === 0 || providerId.length > 64) {
    return NextResponse.json({ error: 'Invalid providerId.' }, { status: 400 });
  }
  if (phone !== undefined && typeof phone !== 'string') {
    return NextResponse.json({ error: 'Invalid phone.' }, { status: 400 });
  }

  // Reuses the existing rate limiter (verifications/services/rate-limiter.ts),
  // namespaced per fingerprint, so a single device/script can't spam this
  // endpoint to pollute its own correlation window.
  if (!checkRateLimit(`risk-signal:${fingerprint}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  recordVerificationSignal({ subject, fingerprint, providerId, phone });

  return NextResponse.json({ recorded: true });
}
