"use client";

import { Button } from '@/shared/ui/button';
import { DiscordIcon } from '@/shared/components/icons/social-icons';
import { useOAuthProvider } from '../../../hooks/use-oauth-provider';
import { VerificationStatusAnnouncer } from '../../shared/verification-status';

interface DiscordAuthProps {
  onSuccess?: (user: unknown) => void;
  onError?: (error: unknown) => void;
}

const POINTS = 6;

export function DiscordAuth({ onSuccess, onError }: DiscordAuthProps) {
  const { status, error, isInFlight, start, retry } = useOAuthProvider({
    providerId: 'discord',
    points: POINTS,
    clientId: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
    exchangeEndpoint: '/verifications/discord',
    buildAuthorizeUrl: ({ clientId, redirectUri, nonce }) =>
      `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20email&state=${nonce}`,
    onSuccess,
    onError,
  });

  if (status === 'verified') {
    return (
      <div className="flex items-center gap-2 text-green-400">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span className="text-sm">Discord verification completed</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <VerificationStatusAnnouncer
        status={status}
        connectingMessage="Redirecting to Discord…"
        pendingMessage="Waiting for Discord to confirm your authorization…"
        errorMessage={error}
        onRetry={retry}
      />

      {status !== 'failed' && (
        <Button
          onClick={start}
          disabled={isInFlight}
          className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white border-0"
        >
          <DiscordIcon size={20} className="mr-2" />
          {isInFlight ? 'Verifying…' : 'Verify with Discord'}
        </Button>
      )}
    </div>
  );
}
