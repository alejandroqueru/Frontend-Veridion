"use client";

import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Separator } from '@/shared/components/separator';
import { X, Clock, DollarSign } from 'lucide-react';
import { GoogleAuth } from './social/google/google-auth';
import { DiscordAuth } from './social/discord/discord-auth';
import { GitHubAuth } from './social/github/github-auth';
import { LinkedInAuth } from './social/linkedin/linkedin-auth';
import { StellarVerification } from './blockchain/stellar-verification';
import { PhoneVerification } from './contact/phone/phone-verification';
import { EmailVerification } from './contact/email/email-verification';
import { PhysicalVerificationFlow } from './physical/physical-verification-flow';
import { getPhysicalFlowConfig } from '../constants/physical-verification-flows';

interface Achievement {
  readonly title: string;
  readonly points: number;
  readonly description: string;
}

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  points: string | number;
  time: string;
  price: string;
  status: string;
  achievements: readonly Achievement[];
  requirements: readonly string[];
  verificationId?: string;
}

/**
 * Maps a verificationId to the body it renders. Every entry's inner
 * component (GitHubAuth, StellarVerification, PhysicalVerificationFlow, …)
 * is itself driven by the shared verification machine (via
 * `useOAuthProvider`/`useSynchronousVerification`) — this registry only
 * replaces the old hardcoded ternary chain with a single lookup, since each
 * provider's props aren't uniform enough to fully genericize further
 * (Stellar takes `onComplete`, Physical Verification takes `methodId`, …).
 */
function renderProviderBody(verificationId: string | undefined, onClose: () => void): React.ReactNode {
  switch (verificationId) {
    case 'google':
      return (
        <GoogleAuth
          onSuccess={onClose}
          onError={(error) => console.error('Google verification failed:', error)}
        />
      );
    case 'discord':
      return (
        <DiscordAuth
          onSuccess={onClose}
          onError={(error) => console.error('Discord verification failed:', error)}
        />
      );
    case 'github':
      return (
        <GitHubAuth
          onSuccess={onClose}
          onError={(error) => console.error('GitHub verification failed:', error)}
        />
      );
    case 'linkedin':
      return (
        <LinkedInAuth
          onSuccess={onClose}
          onError={(error) => console.error('LinkedIn verification failed:', error)}
        />
      );
    case 'stellar-transactions':
      return (
        <StellarVerification
          onComplete={() => onClose()}
          onError={(error) => console.error('Stellar verification failed:', error)}
        />
      );
    case 'phone-verification':
      return (
        <PhoneVerification
          onSuccess={onClose}
          onError={(error) => console.error('Phone verification failed:', error)}
        />
      );
    case 'email-verification':
      return (
        <EmailVerification
          onSuccess={onClose}
          onError={(error) => console.error('Email verification failed:', error)}
        />
      );
    default:
      if (verificationId && getPhysicalFlowConfig(verificationId)) {
        return (
          <PhysicalVerificationFlow
            methodId={verificationId}
            onSuccess={onClose}
            onError={(error) => console.error('Physical verification failed:', error)}
          />
        );
      }
      return (
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={onClose}>
          Close
        </Button>
      );
  }
}

export function VerificationModal({
  isOpen,
  onClose,
  title,
  points,
  time,
  price,
  status: _status,
  achievements: _achievements,
  requirements,
  verificationId
}: VerificationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0e0d0d] border-0 p-0 max-w-4xl h-[95vh] flex flex-col">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Complete this verification to earn {points} points. Estimated time: {time}.
        </DialogDescription>
        <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">{title}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-card-darker to-card-dark border-gray-700/30">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-white">{points}</div>
                <div className="text-xs text-gray-400">points gained</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card-darker to-card-dark border-gray-700/30">
              <CardContent className="p-3 text-center">
                <Clock className="h-3 w-3 text-blue-400 mx-auto mb-1" />
                <div className="text-xs text-gray-400">Time</div>
                <div className="text-sm font-medium text-white">{time}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card-darker to-card-dark border-gray-700/30">
              <CardContent className="p-3 text-center">
                <DollarSign className="h-3 w-3 text-green-400 mx-auto mb-1" />
                <div className="text-xs text-gray-400">Price</div>
                <div className="text-sm font-medium text-white">{price}</div>
              </CardContent>
            </Card>
          </div>



          {/* Content */}
          <div className="flex-1 overflow-y-auto space-y-4">

            <Separator className="bg-gray-700" />

            {/* Requirements */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Stamp Requirements</h3>
              <div className="space-y-2">
                {requirements.map((requirement, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1 h-1 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {requirement}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-700">
            {renderProviderBody(verificationId, onClose)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
