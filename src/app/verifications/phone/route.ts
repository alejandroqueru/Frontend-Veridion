import { NextRequest, NextResponse } from 'next/server';
import { generateOtp, storeOtp, verifyOtp, hashIdentifier, checkBinding, setBinding } from '@/features/verifications/services/otp-service';
import { checkRateLimit } from '@/features/verifications/services/rate-limiter';
import { sendOtpSms } from '@/features/verifications/services/sms-sender';
import { isValidE164 } from '@/features/verifications/utils/phone-utils';

/**
 * Mirrors `src/app/verifications/email/route.ts` — this route simply
 * didn't exist before, so `useOtpFlow({ channel: 'phone', ... })` (used by
 * `PhoneVerification`) 404'd on every send/verify call.
 */
export async function POST(req: NextRequest) {
  const { action, phone, code, wallet } = await req.json();

  if (!phone || !isValidE164(phone)) {
    return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 });
  }

  if (action === 'send') {
    if (!checkRateLimit(`phone-send:${phone}`) || (wallet && !checkRateLimit(`phone-wallet:${wallet}`))) {
      return NextResponse.json({ error: 'Too many requests. Please wait before retrying.' }, { status: 429 });
    }

    if (wallet) {
      const hash = await hashIdentifier(phone, wallet);
      if (checkBinding(hash, wallet) === 'other-wallet') {
        return NextResponse.json({ error: 'This phone number is already linked to another wallet.' }, { status: 409 });
      }
    }

    const otp = generateOtp();
    storeOtp(`phone:${phone}`, otp);

    try {
      await sendOtpSms(phone, otp);
    } catch {
      return NextResponse.json({ error: 'Failed to send SMS. Please try again.' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'verify') {
    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid code format.' }, { status: 400 });
    }

    const result = verifyOtp(`phone:${phone}`, code);

    if (result === 'ok') {
      if (wallet) {
        const hash = await hashIdentifier(phone, wallet);
        setBinding(hash, wallet);
      }
      return NextResponse.json({ success: true });
    }

    const messages: Record<string, string> = {
      expired: 'Code expired. Please request a new one.',
      invalid: 'Incorrect code. Please try again.',
      'too-many-attempts': 'Too many failed attempts. Request a new code.',
    };
    return NextResponse.json({ error: messages[result] ?? 'Verification failed.' }, { status: 400 });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
