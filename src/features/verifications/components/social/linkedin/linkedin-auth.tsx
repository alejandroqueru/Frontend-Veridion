"use client";

import { Button } from '@/shared/ui/button';
import { LinkedInIcon } from '@/shared/components/icons/social-icons';
import { useOAuthProvider } from '../../../hooks/use-oauth-provider';
import { VerificationStatusAnnouncer } from '../../shared/verification-status';

interface LinkedInAuthProps {
  onSuccess?: (user: unknown) => void;
  onError?: (error: unknown) => void;
}

const POINTS = 6;

export function LinkedInAuth({ onSuccess, onError }: LinkedInAuthProps) {
  const { status, error, isInFlight, start, retry } = useOAuthProvider({
    providerId: 'linkedin',
    points: POINTS,
    clientId: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID,
    exchangeEndpoint: '/verifications/linkedin',
    buildAuthorizeUrl: ({ clientId, redirectUri, nonce }) =>
      `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`,
    onSuccess,
    onError,
  });

  if (status === 'verified') {
    return (
      <div className="flex items-center gap-2 text-green-400">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span className="text-sm">LinkedIn verification completed</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <VerificationStatusAnnouncer
        status={status}
        connectingMessage="Redirecting to LinkedIn…"
        pendingMessage="Waiting for LinkedIn to confirm your authorization…"
        errorMessage={error}
        onRetry={retry}
      />

      {status !== 'failed' && (
        <Button
          onClick={start}
          disabled={isInFlight}
          className="w-full bg-[#0077B5] hover:bg-[#005885] text-white"
        >
          <LinkedInIcon size={20} className="mr-2" />
          {isInFlight ? 'Verifying…' : 'Verify with LinkedIn'}
        </Button>
      )}
    </div>
  );
}
