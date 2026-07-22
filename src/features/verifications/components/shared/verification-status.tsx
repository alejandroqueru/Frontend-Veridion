"use client";

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { VerificationLifecycleStatus } from '../../machine/verification-machine';

interface VerificationStatusAnnouncerProps {
  status: VerificationLifecycleStatus;
  connectingMessage?: string;
  pendingMessage?: string;
  verifiedMessage?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

const DEFAULTS: Record<VerificationLifecycleStatus, string> = {
  idle: '',
  connecting: 'Connecting…',
  pending_external: 'Waiting for confirmation…',
  verified: 'Verified successfully.',
  failed: 'Verification failed.',
};

/**
 * Shared status display + accessible retry/recovery affordance for every
 * verification provider. Two `aria-live` regions announce transitions to
 * screen readers independent of the visible UI below them: `polite` for
 * routine progress (connecting/pending/verified), `assertive` for failures,
 * per WAI-ARIA guidance on not interrupting the user for non-urgent updates.
 *
 * The Retry button uses `autoFocus` rather than a manual ref/effect: since
 * it only exists in the DOM while `status === 'failed'`, every entry into
 * that state is a fresh mount, so the browser's native "focus on insert"
 * behavior is enough to move focus there for keyboard/screen-reader users
 * without any imperative focus-management code.
 */
export function VerificationStatusAnnouncer({
  status,
  connectingMessage,
  pendingMessage,
  verifiedMessage,
  errorMessage,
  onRetry,
  onCancel,
}: VerificationStatusAnnouncerProps) {
  const politeMessage =
    status === 'connecting'
      ? connectingMessage ?? DEFAULTS.connecting
      : status === 'pending_external'
      ? pendingMessage ?? DEFAULTS.pending_external
      : status === 'verified'
      ? verifiedMessage ?? DEFAULTS.verified
      : '';

  const assertiveMessage = status === 'failed' ? errorMessage ?? DEFAULTS.failed : '';

  if (status === 'idle') return null;

  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite" className="sr-only">
        {politeMessage}
      </div>
      <div role="alert" aria-live="assertive" className="sr-only">
        {assertiveMessage}
      </div>

      {status === 'connecting' && (
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{connectingMessage ?? DEFAULTS.connecting}</span>
        </div>
      )}

      {status === 'pending_external' && (
        <div className="flex items-center gap-2 text-blue-300 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{pendingMessage ?? DEFAULTS.pending_external}</span>
        </div>
      )}

      {status === 'verified' && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{verifiedMessage ?? DEFAULTS.verified}</span>
        </div>
      )}

      {status === 'failed' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <span>{errorMessage ?? DEFAULTS.failed}</span>
          </div>
          <div className="flex gap-2">
            {onRetry && (
              <Button
                autoFocus
                onClick={onRetry}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Retry
              </Button>
            )}
            {onCancel && (
              <Button onClick={onCancel} size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
