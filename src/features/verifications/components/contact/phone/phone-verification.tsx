"use client";

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Loader2 } from 'lucide-react';
import { useVerificationStore } from '../../../store/verification-store';
import { useOtpFlow } from '../../../hooks/use-otp-flow';
import { OtpInput } from '../otp-input';
import { OtpCountdown } from '../otp-countdown';
import { CountryCodeSelector } from '../country-code-selector';
import { VerificationStepIndicator } from '../verification-step-indicator';
import { ContactVerificationSuccess } from '../contact-verification-success';
import { normalizePhone, isValidE164 } from '../../../utils/phone-utils';
import { OTP_CONFIG } from '../../../constants/contact-verifications';

interface Props {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  wallet?: string;
}

const POINTS = 1000;

export function PhoneVerification({ onSuccess, onError, wallet }: Props) {
  const [countryCode, setCountryCode] = useState('+1');
  const [localPhone, setLocalPhone] = useState('');

  const fullPhone = normalizePhone(countryCode, localPhone);
  const { completeVerification } = useVerificationStore();

  const { step, code, setCode, loading, error, cooldown, sendCode, verifyCode, reset } = useOtpFlow({
    providerId: 'phone-verification',
    channel: 'phone',
    identifier: fullPhone,
    wallet,
    onSuccess: () => {
      completeVerification('phone-verification', 'physical', POINTS);
      onSuccess?.();
    },
    onError,
  });

  function handleSend() {
    if (!isValidE164(fullPhone)) return;
    sendCode();
  }

  if (step === 'done') {
    return (
      <ContactVerificationSuccess
        channel="phone"
        identifier={fullPhone}
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
            Enter your phone number and we&apos;ll send a {OTP_CONFIG.length}-digit code via SMS.
          </p>
          <div className="flex gap-2">
            <CountryCodeSelector
              value={countryCode}
              onChange={setCountryCode}
              disabled={loading}
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={localPhone}
              onChange={e => setLocalPhone(e.target.value.replace(/[^\d\s\-()]/g, ''))}
              disabled={loading}
              className="flex-1 bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          {!isValidE164(fullPhone) && localPhone.length > 3 && (
            <p className="text-yellow-500 text-xs">Enter a valid phone number.</p>
          )}
        </>
      )}

      {step === 'code' && (
        <>
          <p className="text-gray-300 text-sm">
            Code sent to <span className="text-white font-medium">{fullPhone}</span>
          </p>
          <OtpInput value={code} onChange={setCode} disabled={loading} />
          <div className="flex justify-between items-center pt-1">
            <OtpCountdown cooldown={cooldown} onResend={sendCode} disabled={loading} />
            <button
              onClick={reset}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Change number
            </button>
          </div>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        onClick={step === 'input' ? handleSend : verifyCode}
        disabled={loading || (step === 'input' && !isValidE164(fullPhone))}
      >
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {step === 'input' ? 'Send Code' : 'Verify Code'}
      </Button>
    </div>
  );
}
