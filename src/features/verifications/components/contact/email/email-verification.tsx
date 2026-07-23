"use client";

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Loader2 } from 'lucide-react';
import { useVerificationStore } from '../../../store/verification-store';
import { useOtpFlow } from '../../../hooks/use-otp-flow';
import { OtpInput } from '../otp-input';
import { OtpCountdown } from '../otp-countdown';
import { VerificationStepIndicator } from '../verification-step-indicator';
import { ContactVerificationSuccess } from '../contact-verification-success';
import { isValidEmail, maskEmail } from '../../../utils/email-utils';
import { OTP_CONFIG } from '../../../constants/contact-verifications';

interface Props {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  wallet?: string;
}

const POINTS = 500;

export function EmailVerification({ onSuccess, onError, wallet }: Props) {
  const [email, setEmail] = useState('');
  const { completeVerification } = useVerificationStore();

  const { step, code, setCode, loading, error, cooldown, sendCode, verifyCode, reset } = useOtpFlow({
    providerId: 'email-verification',
    channel: 'email',
    identifier: email,
    wallet,
    onSuccess: () => {
      completeVerification('email-verification', 'physical', POINTS);
      onSuccess?.();
    },
    onError,
  });

  function handleSend() {
    if (!isValidEmail(email)) return;
    sendCode();
  }

  if (step === 'done') {
    return (
      <ContactVerificationSuccess
        channel="email"
        identifier={email}
        points={POINTS}
      />
    );
  }

  return (
    <div className="space-y-4">
      <VerificationStepIndicator currentStep={step} />

      {step === 'input' && (
        <>
          <p className="text-gray-300 text-sm">
            Enter your email and we&apos;ll send a {OTP_CONFIG.length}-digit verification code.
          </p>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value.trim())}
            disabled={loading}
            className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          {email.length > 5 && !isValidEmail(email) && (
            <p className="text-yellow-500 text-xs">Enter a valid email address.</p>
          )}
        </>
      )}

      {step === 'code' && (
        <>
          <p className="text-gray-300 text-sm">
            Code sent to <span className="text-white font-medium">{maskEmail(email)}</span>
          </p>
          <OtpInput value={code} onChange={setCode} disabled={loading} />
          <div className="flex justify-between items-center pt-1">
            <OtpCountdown cooldown={cooldown} onResend={sendCode} disabled={loading} />
            <button
              onClick={reset}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Change email
            </button>
          </div>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        onClick={step === 'input' ? handleSend : verifyCode}
        disabled={loading || (step === 'input' && !isValidEmail(email))}
      >
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {step === 'input' ? 'Send Code' : 'Verify Code'}
      </Button>
    </div>
  );
}
