"use client";

import { Card, CardContent } from "@/shared/ui/card";
import { Separator } from "@/shared/components/separator";
import { Badge } from "@/shared/ui/badge";
import { Circle, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { type PhysicalVerification } from "../constants/physical-verifications";
import { type SocialMediaVerification } from "../constants/social-verifications";
import { type BlockchainVerification } from "../constants/blockchain-verifications";
import { useVerificationLifecycle } from "../hooks/use-verification-lifecycle";
import { type VerificationType } from "../store/verification-store";
import { useVerificationModal } from "../hooks/use-verification-modal";
import { VerificationModal } from "./verification-modal";

interface VerificationCardProps {
  method: PhysicalVerification | SocialMediaVerification | BlockchainVerification;
  type?: "physical" | "social" | "blockchain";
  onClick?: () => void;
}

export function VerificationCard({ method, type = "physical", onClick }: VerificationCardProps) {
  const isSocialMedia = type === "social";
  const isBlockchain = type === "blockchain";
  const { status, isHydrated } = useVerificationLifecycle(method.id as VerificationType);
  const isActuallyCompleted = status === "verified";
  const isInFlight = status === "connecting" || status === "pending_external";
  const isFailed = status === "failed";

  // Modal handling
  const { isOpen, selectedVerification, openModal, closeModal } = useVerificationModal();

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      openModal(method.id);
    }
  };


  return (
    <>
        <Card
          className={`border-[2px] relative z-10 cursor-pointer hover:scale-[1.02] transform transition-all duration-200 ${
            isActuallyCompleted
              ? 'bg-dark-green-bg border-green-500 hover:border-green-400'
              : isFailed
              ? 'bg-gradient-to-br from-card-darker to-card-dark border-red-500/50 hover:border-red-400/70'
              : isInFlight
              ? 'bg-gradient-to-br from-card-darker to-card-dark border-blue-500/50 hover:border-blue-400/70'
              : 'bg-gradient-to-br from-card-darker to-card-dark border-gray-700/30 hover:border-gray-600/50'
          }`}
          onClick={handleCardClick}
        >
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-2 sm:space-y-3">
          {/* Header */}
          <div className="flex items-start gap-2 sm:gap-3">
            <div className={`p-1 sm:p-1.5 rounded-lg ${
              isActuallyCompleted 
                ? 'bg-green-500/20' 
                : 'bg-gray-800/50'
            }`}>
              <method.icon
                size={isSocialMedia || isBlockchain ? 16 : 14}
                className={`${isSocialMedia || isBlockchain ? 'sm:w-4 sm:h-4' : 'h-3 w-3 sm:h-4 sm:w-4'} ${
                  isActuallyCompleted 
                    ? 'text-green-300/80' 
                    : 'text-gray-300'
                }`}
              />
            </div>
            <div className="flex-1">
              <h4 className={`font-semibold text-[13px] sm:text-sm ${
                isActuallyCompleted 
                  ? 'text-green-200' 
                  : 'text-white'
              }`}>{method.title}</h4>
              <p className={`text-[13px] mt-1 leading-relaxed ${
                isActuallyCompleted 
                  ? 'text-green-300/80' 
                  : 'text-gray-400'
              }`}>
                {method.description}
              </p>
            </div>
          </div>


          {/* Points and Stats */}
          <div className="space-y-2">
            <Separator className="my-1" />
                <Badge
                  variant="outline"
                  className={`rounded-full p-1.5 text-xs ${
                    isActuallyCompleted
                      ? 'border-green-500 text-green-400 bg-green-500/10'
                      : isFailed
                      ? 'border-red-500 text-red-400 bg-red-500/10'
                      : isInFlight
                      ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                      : 'border-gray-600 text-gray-300 bg-button-verify'
                  }`}
                >
                  {isHydrated && isActuallyCompleted ? (
                    <CheckCircle className="h-4 w-4 mr-1 fill-current" />
                  ) : isHydrated && isFailed ? (
                    <AlertCircle className="h-4 w-4 mr-1" />
                  ) : isHydrated && isInFlight ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Circle className="h-4 w-4 mr-1 fill-current" />
                  )}
                  {method.points} Points
                </Badge>
            
          </div>
        </div>
      </CardContent>
    </Card>
    
    {/* Verification Modal */}
    {selectedVerification && (
      <VerificationModal
        isOpen={isOpen}
        onClose={closeModal}
        title={selectedVerification.title}
        points={selectedVerification.points}
        time={selectedVerification.time}
        price={selectedVerification.price}
        status={selectedVerification.status}
        achievements={selectedVerification.achievements}
        requirements={selectedVerification.requirements}
        verificationId={method.id}
      />
    )}
  </>
  );
}