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
// getDeviceFingerprint() always emits exactly 64 lowercase hex chars
// (SHA-256). Validating the exact shape here — not just a length range —
// means a caller can't smuggle an oversized or non-hash string into the
// correlation store under the `fingerprint` key.
const FINGERPRINT_HASH = /^[a-f0-9]{64}$/;
// E.164 caps a phone number at 15 digits plus the leading '+'.
const MAX_PHONE_LENGTH = 16;

function isValidSubject(subject: unknown): subject is string {
  return typeof subject === 'string' && (STELLAR_ADDRESS.test(subject) || subject.startsWith('tok_'));
}

// Same extraction as api/v1/public/verification-badge/route.ts#clientIp —
// duplicated rather than imported since that route lives under the public
// `v1` surface and this one deliberately doesn't depend on it.
function clientIp(req: NextRequest): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? undefined;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { subject, fingerprint, providerId, phone, timezoneOffsetMinutes } = body;

  if (!isValidSubject(subject)) {
    return NextResponse.json({ error: 'Invalid subject.' }, { status: 400 });
  }
  if (typeof fingerprint !== 'string' || !FINGERPRINT_HASH.test(fingerprint)) {
    return NextResponse.json({ error: 'Invalid fingerprint.' }, { status: 400 });
  }
  if (typeof providerId !== 'string' || providerId.length === 0 || providerId.length > 64) {
    return NextResponse.json({ error: 'Invalid providerId.' }, { status: 400 });
  }
  if (phone !== undefined && (typeof phone !== 'string' || phone.length > MAX_PHONE_LENGTH)) {
    return NextResponse.json({ error: 'Invalid phone.' }, { status: 400 });
  }
  // ±14h in minutes — the full range of real-world UTC offsets.
  if (
    timezoneOffsetMinutes !== undefined &&
    (typeof timezoneOffsetMinutes !== 'number' || Math.abs(timezoneOffsetMinutes) > 840)
  ) {
    return NextResponse.json({ error: 'Invalid timezoneOffsetMinutes.' }, { status: 400 });
  }

  // Reuses the existing rate limiter (verifications/services/rate-limiter.ts).
  // Two independent namespaces: per-fingerprint (a single device/script can't
  // spam this endpoint to pollute its own correlation window) and
  // per-subject (a single account can't do the same by rotating fake
  // fingerprints instead — same defense, the other axis).
  if (
    !checkRateLimit(`risk-signal-fp:${fingerprint}`, 20, 60_000) ||
    !checkRateLimit(`risk-signal-subject:${subject}`, 20, 60_000)
  ) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  await recordVerificationSignal({
    subject,
    fingerprint,
    providerId,
    phone,
    ip: clientIp(req),
    timezoneOffsetMinutes,
  });

  return NextResponse.json({ recorded: true });
}
