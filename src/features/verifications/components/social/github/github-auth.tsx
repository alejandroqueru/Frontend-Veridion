"use client";

import { Button } from '@/shared/ui/button';
import { GitHubIcon } from '@/shared/components/icons/social-icons';
import { useOAuthProvider } from '../../../hooks/use-oauth-provider';
import { VerificationStatusAnnouncer } from '../../shared/verification-status';

interface GitHubAuthProps {
  onSuccess?: (user: unknown) => void;
  onError?: (error: unknown) => void;
}

const POINTS = 6;

export function GitHubAuth({ onSuccess, onError }: GitHubAuthProps) {
  const { status, error, isInFlight, start, retry } = useOAuthProvider({
    providerId: 'github',
    points: POINTS,
    clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
    exchangeEndpoint: '/verifications/github',
    buildAuthorizeUrl: ({ clientId, redirectUri, nonce }) =>
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${nonce}`,
    onSuccess,
    onError,
  });

  if (status === 'verified') {
    return (
      <div className="flex items-center gap-2 text-green-400">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span className="text-sm">GitHub verification completed</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <VerificationStatusAnnouncer
        status={status}
        connectingMessage="Redirecting to GitHub…"
        pendingMessage="Waiting for GitHub to confirm your authorization…"
        errorMessage={error}
        onRetry={retry}
      />

      {status !== 'failed' && (
        <Button
          onClick={start}
          disabled={isInFlight}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white border border-gray-700"
        >
          <GitHubIcon size={20} className="mr-2" />
          {isInFlight ? 'Verifying…' : 'Verify with GitHub'}
        </Button>
      )}
    </div>
  );
}
