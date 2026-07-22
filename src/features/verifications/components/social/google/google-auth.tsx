"use client";

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/shared/ui/button';
import { GoogleIcon } from '@/shared/components/icons/social-icons';
import { useVerificationStore } from '../../../store/verification-store';
import { useSynchronousVerification } from '../../../hooks/use-synchronous-verification';
import { VerificationStatusAnnouncer } from '../../shared/verification-status';

interface GoogleAuthProps {
  onSuccess?: (user: unknown) => void;
  onError?: (error: unknown) => void;
}

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, config: { theme: string; size: string; text: string; width: string; locale?: string }) => void;
        };
      };
    };
  }
}

const POINTS = 6;

export function GoogleAuth({ onSuccess, onError }: GoogleAuthProps) {
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const completeVerification = useVerificationStore((state) => state.completeVerification);
  // No pending_external here: Google's Identity Services flow completes
  // within the same page (popup/One Tap), so there's no browser navigation
  // to resume after — unlike GitHub/Discord/LinkedIn.
  const { status, error, begin, succeed, fail, retry } = useSynchronousVerification('google');

  const handleCredentialResponse = useCallback(
    (response: { credential: string }) => {
      begin();
      import('./google-api')
        .then(({ decodeGoogleJWT }) => {
          const payload = decodeGoogleJWT(response.credential);
          completeVerification('google', 'social', POINTS);
          succeed();
          onSuccess?.(payload);
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Google authentication failed';
          fail(message);
          onError?.(err);
        });
    },
    [begin, completeVerification, succeed, fail, onSuccess, onError],
  );

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'google-signin-locale';
    meta.content = 'en';
    document.head.appendChild(meta);

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client?hl=en';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (!window.google) return;

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId || 'your-google-client-id',
          callback: handleCredentialResponse,
        });
        setIsGoogleLoaded(true);

        setTimeout(() => {
          const buttonContainer = document.getElementById('google-signin-button');
          if (buttonContainer) {
            buttonContainer.innerHTML = '';

            window.google.accounts.id.renderButton(buttonContainer, {
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              width: '300',
              locale: 'en',
            });

            setTimeout(() => {
              const googleButton = buttonContainer.querySelector('div[role="button"]');
              if (googleButton) {
                (googleButton as HTMLElement).style.borderRadius = '9999px';
              }
            }, 100);
          }
        }, 200);
      } catch {
        // Google's script loaded but initialization failed (e.g. malformed
        // client ID) — surfaced to the user via the button staying in its
        // "Loading Google…" disabled state rather than a thrown error.
      }
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
      const existingMeta = document.querySelector('meta[name="google-signin-locale"]');
      if (existingMeta) {
        document.head.removeChild(existingMeta);
      }
    };
  }, [handleCredentialResponse]);

  if (status === 'verified') {
    return (
      <div className="flex items-center gap-2 text-green-400">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span className="text-sm">Google verification completed</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <VerificationStatusAnnouncer
        status={status}
        connectingMessage="Verifying with Google…"
        errorMessage={error}
        onRetry={retry}
      />

      {status !== 'failed' &&
        (status === 'connecting' ? (
          <Button disabled className="w-full bg-white hover:bg-gray-100 text-gray-900 border border-gray-300 rounded-full">
            <GoogleIcon size={20} className="mr-2" />
            Verifying…
          </Button>
        ) : isGoogleLoaded ? (
          <div id="google-signin-button" className="w-full flex justify-center min-h-[48px]"></div>
        ) : (
          <Button disabled className="w-full bg-white hover:bg-gray-100 text-gray-900 border border-gray-300 rounded-full">
            <GoogleIcon size={20} className="mr-2" />
            Loading Google...
          </Button>
        ))}
    </div>
  );
}
