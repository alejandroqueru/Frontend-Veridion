"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/features/dashboard/layout/dashboard-layout";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { HumanityScoreSection } from "@/features/dashboard/components/humanity-secore-section";
import { VerificationSection } from "@/features/dashboard/components/physical-verifications/verification-section";
import { SocialMediaSection } from "@/features/dashboard/components/social-media-verifications/social-media-section";
import { BlockchainSection } from "@/features/dashboard/components/blockchain-verifications/blockchain-section";
import { DataManagementPanel } from "@/features/data-privacy/components/data-management-panel";
import { PostDeletionState } from "@/features/data-privacy/components/post-deletion-state";
import { useDataSubjectStatus } from "@/features/data-privacy/use-data-subject-status";
import { useWalletStore } from "@/features/wallet/store/wallet-store";
import { useAuditLogStore } from "@/features/data-privacy/audit-log-store";
import { useReviewStore } from "@/features/review/store/review-store";
import { ShieldAlert } from "lucide-react";

export default function Dashboard() {
  const dataSubjectStatus = useDataSubjectStatus();
  // Track in-session deletion so we immediately show the banner without
  // requiring a page reload (the store will persist for future loads too).
  const [justDeleted, setJustDeleted] = useState(false);

  const isDeleted = dataSubjectStatus === "deleted" || justDeleted;

  const isConnected = useWalletStore((s) => s.isConnected);
  const markActive = useAuditLogStore((s) => s.markActive);
  
  const flagStatus = useReviewStore((s) => s.getFlagStatusForAccount("current-user"));
  const isSuspended = flagStatus === "confirmed-fraudulent";

  // If the user connects a wallet while in a deleted state, reset them to active
  // so they can build a fresh profile as promised by the post-deletion banner.
  useEffect(() => {
    if (isConnected && (dataSubjectStatus === "deleted" || justDeleted)) {
      markActive();
      setJustDeleted(false);
    }
  }, [isConnected, dataSubjectStatus, justDeleted, markActive]);

  return (
    <>
      <DashboardLayout>
        <div className="py-6 px-4 sm:py-8 sm:px-6 lg:py-12 lg:px-16 xl:px-24">
          {isSuspended ? (
            /* ── Suspended view ── */
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center bg-[#111111] border border-red-500/20 rounded-xl p-8">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Account Suspended</h2>
              <p className="text-gray-400 max-w-md">
                Your account has been suspended due to a violation of our terms of service or detected fraudulent activity.
                If you believe this is a mistake, please contact support.
              </p>
            </div>
          ) : isDeleted ? (
            /* ── Post-deletion view ── */
            <div className="space-y-8">
              <PostDeletionState />
              <DataManagementPanel />
            </div>
          ) : (
            /* ── Normal dashboard ── */
            <>
              <HumanityScoreSection />
              <DashboardOverview />

              <div className="space-y-8">
                <SocialMediaSection />
                <BlockchainSection />
                <VerificationSection />
              </div>
            </>
          )}

          {/* Data management panel is always visible (below verifications when active, unless suspended) */}
          {!isDeleted && !isSuspended && (
            <div className="mt-8">
              <DataManagementPanel onDeleted={() => setJustDeleted(true)} />
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
